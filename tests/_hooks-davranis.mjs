// Yalnız test yardımcısı (davranış testleri): uçları GERÇEK koduyla çalıştırır; veritabanı, e-posta, bildirim, oturum ve ağ sahtedir.
const root = new URL("../", import.meta.url).href;
const stub = (n) => new URL(n, import.meta.url).href;
const D = stub("./_stub-davranis.mjs");
const MAP = {
  "@/lib/db": stub("./_stub-db.mjs"),
  "@/generated/prisma/client": stub("./_stub-prisma-client.mjs"),
  "next/cache": stub("./_stub-next-cache.mjs"),
  "@/lib/admin-guard": stub("./_stub-admin-guard.mjs"),
  "@/lib/revalidate": D,
  "@/lib/email": D,
  "@/lib/notifications": D,
  "@/lib/account": D,
  "@/lib/last-login": D,
  "@/lib/account-deletion-db": D,
};
export async function resolve(s, c, n) {
  if (MAP[s]) return { url: MAP[s], shortCircuit: true };
  if (s === "next/server" || s === "next/headers") return n(s + ".js", c);
  return s.startsWith("@/") ? n(root + s.slice(2) + ".ts", c) : n(s, c);
}
