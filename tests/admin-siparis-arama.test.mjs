import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterQuery, inDateRange, matchesOrderSearch, parseDay, resolveDateRange } from "../lib/admin-order-search.ts";
import { matchesGroups, parseGroupParam } from "../lib/orderStatus.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const o = (id, name, email, phone) => ({ id, phone, user: { name, email } });
const ali = o("abcdef12-3456-7890-aaaa-bbbbbbbbbbbb", "Işıl Çelik", "isil+misafir1a2b@ornek.com", "0555 111 22 33");

test("arama: sipariş kodu (8 hane), tam kimlik ve parça; büyük/küçük harf duyarsız", () => {
  for (const q of ["abcdef12", "ABCDEF12", "abcdef12-3456-7890-aaaa-bbbbbbbbbbbb", "  abcdef12  ", "3456"]) assert.equal(matchesOrderSearch(ali, q), true, q);
  assert.equal(matchesOrderSearch(ali, "abcdef13"), false);
});

test("arama: Türkçe harf ve aksan duyarsız ad; tüm sözcükler bulunmalı", () => {
  for (const q of ["ışıl", "ISIL", "IŞIL ÇELİK", "celik isil", "çelik"]) assert.equal(matchesOrderSearch(ali, q), true, q);
  assert.equal(matchesOrderSearch(ali, "isil kaya"), false);
});

test("arama: e-posta (misafir etiketi temiz), telefon biçimden bağımsız", () => {
  assert.equal(matchesOrderSearch(ali, "isil@ornek.com"), true);
  assert.equal(matchesOrderSearch(ali, "misafir1a2b"), false, "misafir etiketi aranmaz");
  for (const q of ["0555 111 22 33", "05551112233", "+90 555 111 22 33", "555111", "111 22"]) assert.equal(matchesOrderSearch(ali, q), true, q);
  assert.equal(matchesOrderSearch(ali, "0532"), false);
  assert.equal(matchesOrderSearch(o("x1", "A", "a@b.com", null), "0555"), false, "telefonsuz sipariş çökmez");
});

test("arama: boş sorgu hepsini getirir, yalnızca simge hiçbirini getirmez", () => {
  assert.equal(matchesOrderSearch(ali, ""), true);
  assert.equal(matchesOrderSearch(ali, "   "), true);
  assert.equal(matchesOrderSearch(ali, "%%%"), false);
});

// 10 Kasım 2026 12:00 UTC = 15:00 İstanbul
const NOW = new Date("2026-11-10T12:00:00Z");
const ist = (s) => new Date(`${s}+03:00`);

test("tarih: bugün = İstanbul gün sınırları [00:00, ertesi 00:00)", () => {
  const r = resolveDateRange("bugun", undefined, undefined, NOW);
  assert.equal(inDateRange(ist("2026-11-10T00:00:00"), r), true);
  assert.equal(inDateRange(ist("2026-11-10T23:59:59"), r), true);
  assert.equal(inDateRange(ist("2026-11-09T23:59:59"), r), false);
  assert.equal(inDateRange(ist("2026-11-11T00:00:00"), r), false);
});

test("tarih: İstanbul günü UTC gününden önde (00:30 İstanbul = önceki gün 21:30 UTC)", () => {
  const late = new Date("2026-11-09T21:30:00Z");
  const r = resolveDateRange("bugun", undefined, undefined, new Date("2026-11-10T00:10:00+03:00"));
  assert.equal(inDateRange(late, r), true);
});

test("tarih: son 7 gün bugün dahil 7 takvim günü; bu ay, ay başından sonraki ay başına kadar", () => {
  const r = resolveDateRange("son7", undefined, undefined, NOW);
  assert.equal(inDateRange(ist("2026-11-04T00:00:00"), r), true);
  assert.equal(inDateRange(ist("2026-11-03T23:59:59"), r), false);
  assert.equal(inDateRange(ist("2026-11-10T23:59:59"), r), true);
  const m = resolveDateRange("ay", undefined, undefined, NOW);
  assert.equal(inDateRange(ist("2026-11-01T00:00:00"), m), true);
  assert.equal(inDateRange(ist("2026-10-31T23:59:59"), m), false);
  assert.equal(inDateRange(ist("2026-11-30T23:59:59"), m), true);
  assert.equal(inDateRange(ist("2026-12-01T00:00:00"), m), false);
  const dec = resolveDateRange("ay", undefined, undefined, new Date("2026-12-31T20:59:00Z"));
  assert.equal(inDateRange(ist("2026-12-31T23:59:00"), dec), true, "yıl sonu");
  assert.equal(inDateRange(ist("2027-01-01T00:00:00"), dec), false);
});

test("tarih: özel aralık bitiş günü dahil; tek uç açık; ters sıra yer değiştirir; geçersiz tarih yok sayılır", () => {
  const r = resolveDateRange("ozel", "2026-11-03", "2026-11-05", NOW);
  assert.equal(inDateRange(ist("2026-11-03T00:00:00"), r), true);
  assert.equal(inDateRange(ist("2026-11-05T23:59:59"), r), true);
  assert.equal(inDateRange(ist("2026-11-06T00:00:00"), r), false);
  assert.equal(inDateRange(ist("2026-11-02T23:59:59"), r), false);
  assert.deepEqual(resolveDateRange("ozel", "2026-11-05", "2026-11-03", NOW), r);
  const from = resolveDateRange("ozel", "2026-11-05", undefined, NOW);
  assert.equal(inDateRange(ist("2030-01-01T00:00:00"), from), true);
  assert.equal(inDateRange(ist("2026-11-04T23:59:59"), from), false);
  assert.equal(resolveDateRange("ozel", "2026-02-31", "yanlis", NOW), null);
  assert.equal(parseDay("2026-02-31"), null);
  assert.equal(resolveDateRange("bilinmeyen", undefined, undefined, NOW), null);
  assert.equal(resolveDateRange(undefined, "2026-11-03", undefined, NOW), null, "ön ayar yoksa tarihler uygulanmaz");
  assert.equal(inDateRange(new Date(0), null), true);
});

test("kesişim ve sayaç tutarlılığı: liste = durum çipi ∩ arama ∩ tarih; sayaçlar aynı kümeden", () => {
  const mk = (id, name, status, day) => ({ id, status, createdAt: ist(`${day}T10:00:00`), phone: null, user: { name, email: `${name}@x.com` } });
  const orders = [mk("a1", "ayse", "PENDING", "2026-11-10"), mk("a2", "ayse", "DELIVERED", "2026-11-10"), mk("b1", "can", "PENDING", "2026-11-10"), mk("a3", "ayse", "PENDING", "2026-10-01")];
  const range = resolveDateRange("bugun", undefined, undefined, NOW);
  const scoped = orders.filter((x) => matchesOrderSearch(x, "ayse") && inDateRange(x.createdAt, range));
  assert.deepEqual(scoped.map((x) => x.id), ["a1", "a2"]);
  const visible = scoped.filter((x) => matchesGroups(x, parseGroupParam(undefined)));
  assert.deepEqual(visible.map((x) => x.id), ["a1"], "varsayılan çipler teslim edileni gizler");
  const all = scoped.filter((x) => matchesGroups(x, parseGroupParam("tumu")));
  assert.equal(all.length, scoped.length, "Tümü sayacı = süzülmüş küme");
});

test("süzgeç adresi: boş alanlar atılır, geçersiz ön ayar/tarih düşer", () => {
  assert.equal(filterQuery({}), "");
  assert.equal(filterQuery({ durum: "yeni", q: "  ayşe  " }), "?durum=yeni&q=ay%C5%9Fe");
  assert.equal(filterQuery({ tarih: "son7", bas: "2026-11-01" }), "?tarih=son7", "özel olmayan ön ayarda tarihler taşınmaz");
  assert.equal(filterQuery({ tarih: "ozel", bas: "2026-11-01", bit: "yanlis" }), "?tarih=ozel&bas=2026-11-01");
  assert.equal(filterQuery({ tarih: "hack" }), "");
});

test("bağlantı: sayfa süzgeci sunucuda uygular; çipler, form ve rozetler doğru kümeyi kullanır", () => {
  const page = read("../app/admin/page.tsx");
  assert.match(page, /matchesOrderSearch\(o, sp\.q \?\? ""\) && inDateRange\(o\.createdAt, dateRange\)/);
  assert.match(page, /const visibleOrders = scopedOrders\.filter\(\(o\) => matchesGroups\(o, selectedGroups\)\)/);
  assert.match(page, /counts=\{groupCounts\} total=\{scopedOrders\.length\} filters=\{orderFilters\}/);
  assert.match(page, /allGroupCounts\.yeni/, "bölüm rozeti süzgeçten bağımsız");
  const f = read("../components/AdminOrderFilters.tsx");
  assert.match(f, /filterQuery\(\{ \.\.\.filters, durum: next \}\)/);
  assert.match(f, /<form action="\/admin#siparisler" method="get"/);
  for (const n of ['name="q"', 'name="tarih"', 'name="bas"', 'name="bit"']) assert.ok(f.includes(n), n);
});
