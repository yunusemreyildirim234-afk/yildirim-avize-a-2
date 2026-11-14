// Yalnız test yardımcısı: "@/..." takma adını çözer; veritabanı ve Prisma istemcisini bellek içi sahtelerle değiştirir.
const root = new URL("../", import.meta.url).href;
const stub = (n) => new URL(n, import.meta.url).href;
const MAP = { "@/lib/db": stub("./_stub-db.mjs"), "@/generated/prisma/client": stub("./_stub-prisma-client.mjs") };
export async function resolve(s, c, n) {
  if (MAP[s]) return { url: MAP[s], shortCircuit: true };
  return s.startsWith("@/") ? n(root + s.slice(2) + ".ts", c) : n(s, c);
}
