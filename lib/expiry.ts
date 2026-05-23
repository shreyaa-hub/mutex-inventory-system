import prisma from "./prisma";

/**
 * Releases any PENDING reservations that have passed their expiresAt.
 * We call this lazily — on reads/writes — so we don't need
 * a separate cron job for the basic case.
 *
 * In production we'd also add a Vercel Cron for guaranteed
 * cleanup even if traffic is low.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  // find all expired pending reservations
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    select: {
      id: true,
      productId: true,
      warehouseId: true,
      quantity: true,
    },
  });

  if (expired.length === 0) {
    return 0;
  }

  // release them safely in a transaction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    for (const r of expired) {
      /**
       * IMPORTANT:
       * Use updateMany with status=PENDING check
       * so concurrent cleanup calls can't release
       * the same reservation twice.
       */
      const updated = await tx.reservation.updateMany({
        where: {
          id: r.id,
          status: "PENDING",
        },
        data: {
          status: "RELEASED",
        },
      });

      // already processed by another request
      if (updated.count === 0) {
        continue;
      }

      // give reserved units back to available stock
      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: r.productId,
            warehouseId: r.warehouseId,
          },
        },
        data: {
          reserved: {
            decrement: r.quantity,
          },
        },
      });
    }
  });

  return expired.length;
}