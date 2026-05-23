import { PrismaClient } from "@prisma/client";

// next.js hot reload creates multiple prisma instances in dev
// this pattern keeps it to one across HMR cycles
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;
