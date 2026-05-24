import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean database so the seed remains re-runnable
  await prisma.reservation.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  /*
    Warehouses
  */

  const wh1 = await prisma.warehouse.create({
    data: {
      name: "Mumbai Central Medical Hub",
      location: "Mumbai, MH",
    },
  });

  const wh2 = await prisma.warehouse.create({
    data: {
      name: "Bangalore South Healthcare Depot",
      location: "Bangalore, KA",
    },
  });

  const wh3 = await prisma.warehouse.create({
    data: {
      name: "Delhi NCR Emergency Supply Center",
      location: "Gurugram, HR",
    },
  });

  /*
    Products
  */

  const p1 = await prisma.product.create({
    data: {
      name: "N95 Respirator Mask",
      description:
        "NIOSH-certified disposable respiratory protection mask for clinical environments.",
      price: 1499,
    },
  });

  const p2 = await prisma.product.create({
    data: {
      name: "Surgical Examination Gloves",
      description:
        "Sterile latex-free disposable gloves used in healthcare and laboratory procedures.",
      price: 899,
    },
  });

  const p3 = await prisma.product.create({
    data: {
      name: "Portable Oxygen Cylinder",
      description:
        "Emergency oxygen support cylinder with regulator kit for critical care transport.",
      price: 12999,
    },
  });

  /*
    Stock Levels

    Intentionally includes:
    - low stock
    - zero stock
    - uneven distribution

    Useful for:
    - reservation testing
    - concurrency testing
    - disabled state UI
    - expiry lifecycle testing
  */

  await prisma.stockLevel.createMany({
    data: [
      // N95 Masks
      {
        productId: p1.id,
        warehouseId: wh1.id,
        totalUnits: 120,
        reserved: 0,
      },
      {
        productId: p1.id,
        warehouseId: wh2.id,
        totalUnits: 45,
        reserved: 0,
      },
      {
        productId: p1.id,
        warehouseId: wh3.id,
        totalUnits: 10,
        reserved: 0,
      },

      // Gloves
      {
        productId: p2.id,
        warehouseId: wh1.id,
        totalUnits: 60,
        reserved: 0,
      },
      {
        productId: p2.id,
        warehouseId: wh2.id,
        totalUnits: 0,
        reserved: 0,
      }, // intentionally out of stock

      {
        productId: p2.id,
        warehouseId: wh3.id,
        totalUnits: 25,
        reserved: 0,
      },

      // Oxygen Cylinders
      {
        productId: p3.id,
        warehouseId: wh1.id,
        totalUnits: 12,
        reserved: 0,
      },
      {
        productId: p3.id,
        warehouseId: wh2.id,
        totalUnits: 1,
        reserved: 0,
      }, // low stock for concurrency testing

      {
        productId: p3.id,
        warehouseId: wh3.id,
        totalUnits: 8,
        reserved: 0,
      },
    ],
  });

  console.log(
    "Done. Created 3 warehouses, 3 products, and 9 stock level records."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });