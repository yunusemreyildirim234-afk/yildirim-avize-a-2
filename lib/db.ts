import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var prismaInstance: PrismaClient | undefined;
}

// Prisma 7: sorgular sürücü adaptörü (node-pg) üzerinden gider. Neon bağlantı dizesi ortamdan okunur.
function createClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
}

export const prisma = globalThis.prismaInstance ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaInstance = prisma;
}
