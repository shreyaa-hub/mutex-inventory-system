import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({ where: { id } });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  // idempotent — releasing an already-released reservation is fine
  if (reservation.status === "RELEASED") {
    return NextResponse.json(reservation, { status: 200 });
  }

  if (reservation.status === "CONFIRMED") {
    return NextResponse.json(
      { error: "Cannot release a confirmed reservation" },
      { status: 409 }
    );
  }

  // release: give the units back to available stock
  const released = await prisma.$transaction(// eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (tx: any) => {
    const updated = await tx.reservation.update({
      where: { id },
      data: { status: "RELEASED" },
    });

    await tx.stockLevel.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: { reserved: { decrement: reservation.quantity } },
    });

    return updated;
  });

  return NextResponse.json(released);
}
