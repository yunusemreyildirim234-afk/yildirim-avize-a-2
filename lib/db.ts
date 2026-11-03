import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var prismaInstance: PrismaClient | undefined;
}

// Prisma 7: sorgular sürücü adaptörü (node-pg) üzerinden gider. Neon bağlantı dizesi ortamdan okunur.
function createClient() {
  // Sunucusuz ortamda her örnek az bağlantı tutsun (Neon pooler); bekleyen bağlantılar kapansın, bağlantı kurulamazsa hızlı hata ver.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.prismaInstance ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaInstance = prisma;
}
