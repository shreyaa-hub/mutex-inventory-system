import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // clean up first so the script is re-runnable
  await prisma.reservation.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // warehouses
  const wh1 = await prisma.warehouse.create({
    data: { name: "Mumbai Central", location: "Mumbai, MH" },
  });
  const wh2 = await prisma.warehouse.create({
    data: { name: "Bangalore South", location: "Bangalore, KA" },
  });
  const wh3 = await prisma.warehouse.create({
    data: { name: "Delhi NCR", location: "Gurugram, HR" },
  });

  // products
  const p1 = await prisma.product.create({
    data: {
      name: "Wireless Noise-Cancelling Headphones",
      description: "Over-ear, 30hr battery, active noise cancellation",
      price: 8999,
    },
  });
  const p2 = await prisma.product.create({
    data: {
      name: "Mechanical Keyboard",
      description: "TKL layout, Cherry MX Brown switches, RGB backlight",
      price: 5499,
    },
  });
  const p3 = await prisma.product.create({
    data: {
      name: "USB-C Hub 7-in-1",
      description: "HDMI 4K, 3x USB-A, SD card, PD charging",
      price: 2199,
    },
  });

  // stock levels — sparse intentionally to show the 0-stock disabled state
  await prisma.stockLevel.createMany({
    data: [
      { productId: p1.id, warehouseId: wh1.id, totalUnits: 10, reserved: 0 },
      { productId: p1.id, warehouseId: wh2.id, totalUnits: 5, reserved: 0 },
      { productId: p1.id, warehouseId: wh3.id, totalUnits: 2, reserved: 0 },

      { productId: p2.id, warehouseId: wh1.id, totalUnits: 3, reserved: 0 },
      { productId: p2.id, warehouseId: wh2.id, totalUnits: 0, reserved: 0 }, // out of stock
      { productId: p2.id, warehouseId: wh3.id, totalUnits: 7, reserved: 0 },

      { productId: p3.id, warehouseId: wh1.id, totalUnits: 20, reserved: 0 },
      { productId: p3.id, warehouseId: wh2.id, totalUnits: 1, reserved: 0 }, // low stock — good for concurrency demo
      { productId: p3.id, warehouseId: wh3.id, totalUnits: 15, reserved: 0 },
    ],
  });

  console.log("Done. Created 3 warehouses, 3 products, 9 stock levels.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
