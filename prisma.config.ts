import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: bağlantı adresi şemadan değil buradan okunur (yalnızca değişken ADI; değer .env/ortamdan gelir).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // CLI (migrate/db/studio): varsa DIRECT_URL (doğrudan bağlantı), yoksa DATABASE_URL. Uygulama çalışma zamanı lib/db.ts'te DATABASE_URL (pooler) kullanır.
    // generate/derleme için bağlantı gerekmez; değerler yalnızca ortamdan okunur.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
