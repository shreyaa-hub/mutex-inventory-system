import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";

export async function GET() {
  // lazy expiry cleanup before we return stock numbers
  await releaseExpiredReservations();

  const products = await prisma.product.findMany({
    include: {
      stockLevels: {
        include: { warehouse: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // shape the response — available = total - reserved
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = products.map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stock: p.stockLevels.map((s: any) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      location: s.warehouse.location,
      total: s.totalUnits,
      reserved: s.reserved,
      available: s.totalUnits - s.reserved,
    })),
  }));

  return NextResponse.json(result);
}
