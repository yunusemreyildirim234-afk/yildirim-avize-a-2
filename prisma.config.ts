import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: bağlantı adresi şemadan değil buradan okunur (yalnızca değişken ADI; değer .env/ortamdan gelir).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "", // generate/derleme için bağlantı gerekmez; değer ortamdan gelir
  },
});
