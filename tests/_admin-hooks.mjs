// Yalnız test yardımcısı: admin uçlarını gerçek kodla çalıştırmak için oturum denetimi, veritabanı ve vitrin yenilemeyi sahtelerle değiştirir.
// Oturum: globalThis.__adminAuthed === true ise geçer, aksi hâlde 401.
const root = new URL("../", import.meta.url).href;
const stub = (n) => new URL(n, import.meta.url).href;
const MAP = {
  "@/lib/db": stub("./_stub-db.mjs"),
  "@/generated/prisma/client": stub("./_stub-prisma-client.mjs"),
  "next/cache": stub("./_stub-next-cache.mjs"),
  "@/lib/admin-guard": stub("./_stub-admin-guard.mjs"),
  "@/lib/revalidate": stub("./_stub-revalidate.mjs"),
};
export async function resolve(s, c, n) {
  if (MAP[s]) return { url: MAP[s], shortCircuit: true };
  if (s === "next/server" || s === "next/headers") return n(s + ".js", c);
  return s.startsWith("@/") ? n(root + s.slice(2) + ".ts", c) : n(s, c);
}
