import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { acquireLock } from "@/lib/lock";
import { reserveSchema } from "@/lib/schemas";
import { releaseExpiredReservations } from "@/lib/expiry";

// reservation window — 10 minutes
const RESERVATION_WINDOW_MS = 10 * 60 * 1000;
// const RESERVATION_WINDOW_MS = 30 * 1000; for testing

export async function POST(req: NextRequest) {
  const body = await req.json();

  // validate input
  const parsed = reserveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { productId, warehouseId, quantity } = parsed.data;

  // --- idempotency bonus ---
  // if client sends Idempotency-Key, return the original response on retry
  const idempotencyKey = req.headers.get("Idempotency-Key") ?? undefined;
  if (idempotencyKey) {
    const existing = await prisma.reservation.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      // return original result — status 200 even if it's a repeat
      return NextResponse.json(existing, { status: 200 });
    }
  }

  // run lazy expiry before checking stock so released units are counted
  await releaseExpiredReservations();

  // --- concurrency safety ---
  // lock key is per product+warehouse so we don't block unrelated stock
  const lockKey = `lock:stock:${productId}:${warehouseId}`;
  const release = await acquireLock(lockKey);

  if (!release) {
    // another request is currently holding the lock — tell the client to retry
    return NextResponse.json(
      { error: "Stock is being updated, please retry in a moment" },
      { status: 503 }
    );
  }

  try {
    // inside the lock: read stock and create reservation atomically in a tx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const stock = await tx.stockLevel.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } },
      });

      if (!stock) {
        return { ok: false, status: 404, error: "No stock record found for this product/warehouse" };
      }

      const available = stock.totalUnits - stock.reserved;
      if (available < quantity) {
        return {
          ok: false,
          status: 409,
          error: `Not enough stock. Requested: ${quantity}, available: ${available}`,
        };
      }

      // increment reserved count
      await tx.stockLevel.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: { reserved: { increment: quantity } },
      });

      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: "PENDING",
          expiresAt: new Date(Date.now() + RESERVATION_WINDOW_MS),
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
      });

      return { ok: true, reservation };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.reservation, { status: 201 });
  } finally {
    // always release the lock, even if an error was thrown
    await release();
  }
}
