// Yalnız test yardımcısı: sipariş/teklif ucunu gerçek kodla çalıştırmak için dış bağımlılıkları (oturum, e-posta, PayTR, önbellek) sahtelerle değiştirir.
const root = new URL("../", import.meta.url).href;
const stub = (n) => new URL(n, import.meta.url).href;
const SHARED = stub("./_stub-route-deps.mjs");
const MAP = {
  "@/lib/db": stub("./_stub-db.mjs"),
  "@/generated/prisma/client": stub("./_stub-prisma-client.mjs"),
  "next/cache": stub("./_stub-next-cache.mjs"),
  "@/lib/account": SHARED,
  "@/lib/orders": SHARED,
  "@/lib/paytr": SHARED,
  "@/lib/marketing": SHARED,
  "@/lib/revalidate": SHARED,
  "@/lib/showcase": SHARED,
};
export async function resolve(s, c, n) {
  if (MAP[s]) return { url: MAP[s], shortCircuit: true };
  if (s === "next/server" || s === "next/headers") return n(s + ".js", c);
  return s.startsWith("@/") ? n(root + s.slice(2) + ".ts", c) : n(s, c);
}
