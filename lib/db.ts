import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { withDbRetry } from "@/lib/db-retry";

// Prisma 7: sorgular sürücü adaptörü (node-pg) üzerinden gider. Neon bağlantı dizesi ortamdan okunur.
function createClient() {
  // Sunucusuz ortamda her örnek az bağlantı tutsun (Neon pooler); bekleyen bağlantılar kapansın, bağlantı kurulamazsa hızlı hata ver.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
  // Neon uyanırken bağlantı kurulamazsa sorgu düzeyinde tek seferlik yeniden deneme (kurallar: lib/db-retry.ts).
  // $transaction (etkileşimli veya dizi) içindeki işlemlere dokunulmaz.
  // Dışa açılan tip PrismaClient kalır: genişletilmiş istemci tipi, diğer dosyalardaki TransactionClient imzalarıyla uyuşmaz.
  const extended = new PrismaClient({ adapter }).$extends({
    query: {
      $allOperations(params) {
        const { operation, args, query } = params;
        const internal = (params as unknown as { __internalParams?: { transaction?: unknown } }).__internalParams;
        if (internal?.transaction) return query(args);
        return withDbRetry(() => query(args), operation);
      },
    },
  });
  return extended as unknown as PrismaClient;
}

declare global {
  var prismaInstance: PrismaClient | undefined;
}

export const prisma = globalThis.prismaInstance ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaInstance = prisma;
}
