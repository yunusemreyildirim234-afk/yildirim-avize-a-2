import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("hareket ucu: GET yönetici oturumu ve hız sınırıyla korunur", () => {
  const r = read("../app/api/admin/activity/route.ts");
  const get = r.slice(r.indexOf("export async function GET"), r.indexOf("export async function DELETE"));
  assert.match(get, /adminGuard\(\)/);
  assert.match(get, /rateLimit\(/);
  assert.match(get, /getActivity\(\)/);
});

test("panel sayfası hareket satırlarını yüklemez; yalnız hata sayımı (eski kayıt temizliği cron'da)", () => {
  const p = read("../app/admin/page.tsx");
  assert.doesNotMatch(p, /getActivity/);
  assert.match(p, /countRecentErrors\(\)/);
  assert.doesNotMatch(p, /purgeOldEvents/);
  assert.match(p, /<AdminActivity \/>/);
});

test("AdminActivity bölüm açılınca çeker (açık bilgisi AdminSection'dan gelir)", () => {
  const a = read("../components/AdminActivity.tsx");
  assert.match(a, /useSectionOpen\(\)/);
  assert.match(a, /fetch\("\/api\/admin\/activity"/);
  assert.match(a, /Yeniden dene/);
  assert.match(read("../components/AdminSection.tsx"), /SectionOpenContext\.Provider value=\{open\}/);
});

test("mesaj ve yorum listeleri sayfada yüklenmez; yalnız bekleyen sayıları gelir", () => {
  const p = read("../app/admin/page.tsx");
  assert.doesNotMatch(p, /contactMessage\.findMany/);
  assert.doesNotMatch(p, /prisma\.review\.findMany/);
  assert.match(p, /contactMessage\.count\(\{ where: \{ status: "PENDING" \} \}\)/);
  assert.match(p, /<AdminMessages \/>/);
  assert.match(p, /<AdminReviews \/>/);
});

test("mesaj/yorum uçları: GET yönetici korumalı, take 200 / 300", () => {
  for (const [f, take] of [["messages", 200], ["reviews", 300]]) {
    const r = read(`../app/api/admin/${f}/route.ts`);
    const get = r.slice(r.indexOf("export async function GET"), r.indexOf("export async function", r.indexOf("export async function GET") + 10) > 0 ? r.indexOf("export async function", r.indexOf("export async function GET") + 10) : undefined);
    assert.match(get, /adminGuard\(\)/, f);
    assert.match(get, new RegExp(`take: ${take}`), f);
  }
});

test("liste bileşenleri bölüm açılınca çeker; yükleniyor ve hata mesajı var", () => {
  const h = read("../components/useAdminList.tsx");
  assert.match(h, /useSectionOpen\(\)/);
  assert.match(h, /Yükleniyor…/);
  assert.match(h, /Yeniden dene/);
  assert.match(read("../components/AdminMessages.tsx"), /useAdminList<AdminMessage\[\]>\("\/api\/admin\/messages"\)/);
  assert.match(read("../components/AdminReviews.tsx"), /useAdminList<AdminReview\[\]>\("\/api\/admin\/reviews"\)/);
});
