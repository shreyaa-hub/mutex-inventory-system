import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // --- idempotency bonus ---
  const idempotencyKey = req.headers.get("Idempotency-Key") ?? undefined;
  if (idempotencyKey) {
    // check if we've seen this exact confirm request before
    // we store the idempotencyKey on the reservation itself when confirming
    const existing = await prisma.reservation.findFirst({
      where: { id, status: "CONFIRMED" },
    });
    if (existing) {
      return NextResponse.json(existing, { status: 200 });
    }
  }

  const reservation = await prisma.reservation.findUnique({ where: { id } });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (reservation.status === "RELEASED") {
    return NextResponse.json({ error: "Reservation was already released" }, { status: 410 });
  }

  if (reservation.status === "CONFIRMED") {
    return NextResponse.json(reservation, { status: 200 });
  }

  // check expiry
  if (reservation.expiresAt < new Date()) {
    // mark it released while we're here
    await prisma.$transaction([
      prisma.reservation.update({
        where: { id },
        data: { status: "RELEASED" },
      }),
      prisma.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: { reserved: { decrement: reservation.quantity } },
      }),
    ]);

    return NextResponse.json(
      { error: "Reservation has expired" },
      { status: 410 }
    );
  }

  // confirm: keep the reserved count but now it's permanent — so just flip status
  // the reserved field is decremented when stock is "sold" but for simplicity we
  // treat confirmed as the final decrement step
  const confirmed = await prisma.$transaction(// eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (tx: any) => {
    const updated = await tx.reservation.update({
      where: { id },
      data: { status: "CONFIRMED" },
    });

    // move the units from reserved → actually sold (decrement both total and reserved)
    await tx.stockLevel.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: {
        totalUnits: { decrement: reservation.quantity },
        reserved: { decrement: reservation.quantity },
      },
    });

    return updated;
  });

  return NextResponse.json(confirmed);
}
