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
