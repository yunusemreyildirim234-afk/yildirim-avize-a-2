import test from "node:test";
import assert from "node:assert/strict";
import { planRename, planBulkColor, distinctColors, nameKey } from "../lib/variation-input.ts";

const ctx = (o = {}) => ({ type: "Seçenek", current: "Bej / 45 x 25", others: [], productEbat: null, ...o });
const ok = (r) => (assert.equal(r.ok, true, JSON.stringify(r)), r.value);
const err = (r) => (assert.equal(r.ok, false, JSON.stringify(r)), r.error);

test("planRename: normalize (renk tr-TR başlık biçimi, ebat 'a x b')", () => {
  assert.equal(ok(planRename("krom/58x58", ctx())).value, "Krom / 58 x 58");
  assert.equal(ok(planRename("  LAK   gold  /  63 X 63 ", ctx())).value, "Lak Gold / 63 x 63");
  assert.equal(ok(planRename("ışık", ctx({ type: "Renk" }))).value, "Işık");
  assert.equal(ok(planRename("iNCİ", ctx({ type: "Renk" }))).value, "İnci");
  assert.equal(ok(planRename("krom / 12,5x10", ctx())).value, "Krom / 12,5 x 10");
});

test("planRename: filtre okuması (variationAttrs ile aynı)", () => {
  const a = ok(planRename("krom/58x58", ctx())).attrs;
  assert.equal(a.c.n, "Krom");
  assert.equal(a.s.n, "58 x 58");
  assert.equal(ok(planRename("Sarı", ctx())).attrs.s, null);
});

test("planRename engelleri", () => {
  assert.match(err(planRename("", ctx())), /boş/);
  assert.match(err(planRename("   ", ctx())), /boş/);
  assert.match(err(planRename(null, ctx())), /boş/);
  assert.match(err(planRename("a".repeat(61), ctx())), /60/);
  assert.match(err(planRename("Bej - 58 x 58", ctx())), /Biçim/);
  assert.match(err(planRename("58 x 58 / Bej", ctx())), /Biçim/);
  assert.match(err(planRename("Bej / 58 x 58 cm", ctx())), /Ebat geçerli değil/);
  assert.match(err(planRename("Bej / 58", ctx())), /Ebat geçerli değil/);
  assert.match(err(planRename("Bej / 58 x 58 / 3", ctx())), /Biçim/);
  assert.match(err(planRename("Bej / 58 x 58 / 3 / 4", ctx())), /Biçim/);
  assert.match(err(planRename("Bej /", ctx())), /Biçim/);
  assert.match(err(planRename("Bej / 45 x 25", ctx())), /değişmedi/);
});

test("planRename: aynı üründe çakışma (büyük/küçük ve Türkçe harf farkı gözetmeden)", () => {
  const others = ["Işık / 45 x 25", "Krom"];
  assert.match(err(planRename("IŞIK/45x25", ctx({ others }))), /zaten var/);
  assert.match(err(planRename("isik / 45 x 25", ctx({ others }))), /zaten var/);
  assert.match(err(planRename("krom", ctx({ others }))), /zaten var/);
  ok(planRename("Krom / 45 x 25", ctx({ others })));
  assert.equal(nameKey("Işık / 45x25"), nameKey("ışık / 45 x 25"));
});

test("planRename: izin listesi dışı renk uyarı/onay gerektirmez, yalnızca bilgi verir ve filtreye girer", () => {
  const z = ok(planRename("Zümrüt / 45 x 25", ctx()));
  assert.deepEqual(z.warnings, []);
  assert.deepEqual(z.notes, ["Bu renk filtreye otomatik eklenir."]);
  assert.equal(z.type, "Renk"); // "Seçenek" + liste dışı renk → "Renk": filtre okur
  assert.equal(z.attrs.c.n, "Zümrüt");
  const g = ok(planRename("günışığı / 45 x 25", ctx()));
  assert.equal(g.value, "Günışığı / 45 x 25");
  assert.equal(g.attrs.c.n, "Günışığı");
  // Listedeki renk: bilgi yok, tür değişmez
  const k = ok(planRename("Krom / 45 x 25", ctx()));
  assert.deepEqual([k.warnings, k.notes, k.type], [[], [], "Seçenek"]);
  // Renk tipi: tür aynı kalır, yine bilgi
  const r = ok(planRename("Zümrüt / 45 x 25", ctx({ type: "Renk" })));
  assert.deepEqual([r.warnings, r.type, r.notes.length], [[], "Renk", 1]);
  // Ebat uyarısı eskisi gibi; ürün ebadı varsa yok
  // Ebat yok uyarısı; ürün ebadı varsa yok
  assert.match(ok(planRename("Krom", ctx())).warnings[0], /ebat/i);
  assert.deepEqual(ok(planRename("Krom", ctx({ productEbat: "45 x 25" }))).warnings, []);
});

const V = (id, value, type = "Seçenek") => ({ id, type, value });
const set = [V("1", "Bej / 45 x 25"), V("2", "bej / 50 x 50"), V("3", "Krom / 45 x 25"), V("4", "Bej")];

test("distinctColors: benzersiz, büyük/küçük harf duyarsız", () => {
  assert.deepEqual(distinctColors(set), ["Bej", "Krom"]);
  assert.deepEqual(distinctColors([V("a", "Işık"), V("b", "IŞIK / 9 x 14")]), ["Işık"]);
});

test("planBulkColor: yalnızca eski rengin parçası değişir, ebat olduğu gibi kalır", () => {
  const p = ok(planBulkColor(set, "Bej", "gold"));
  assert.equal(p.newColor, "Gold");
  assert.deepEqual(p.changes.map((c) => [c.id, c.from, c.to]), [["1", "Bej / 45 x 25", "Gold / 45 x 25"], ["2", "bej / 50 x 50", "Gold / 50 x 50"], ["4", "Bej", "Gold"]]);
  assert.equal(p.changes[0].attrs.c.n, "Gold");
  assert.equal(p.changes[0].attrs.s.n, "45 x 25");
  assert.deepEqual(p.warnings, []);
});

test("planBulkColor: ebat metni biçimi dokunulmadan korunur", () => {
  const p = ok(planBulkColor([V("1", "Bej/45x25")], "Bej", "Krom"));
  assert.equal(p.changes[0].to, "Krom / 45x25");
});

test("planBulkColor: Türkçe harf (İ/ı) eşleşmesi", () => {
  const p = ok(planBulkColor([V("1", "Işık / 9 x 14"), V("2", "Mavi")], "ışık", "Gümüş"));
  assert.equal(p.changes.length, 1);
  assert.equal(p.changes[0].to, "Gümüş / 9 x 14");
});

test("planBulkColor: eski renk yok / yeni renk boş / aynı", () => {
  assert.match(err(planBulkColor(set, "Mor", "Gold")), /bulunamadı/);
  assert.match(err(planBulkColor(set, "", "Gold")), /Eski/);
  assert.match(err(planBulkColor(set, "Bej", "  ")), /boş/);
  assert.match(err(planBulkColor([V("1", "Bej / 45 x 25")], "Bej", "bej")), /Değişecek varyasyon yok/);
  assert.match(err(planBulkColor(set, "Bej", "Gold / 45 x 25")), /\//);
  assert.match(err(planBulkColor(set, "Bej", "58 x 58")), /Biçim/);
  assert.match(err(planBulkColor(set, "Bej", "x".repeat(61))), /60/);
});

test("planBulkColor: çakışma engeli iki adı yazar", () => {
  const e = err(planBulkColor(set, "Bej", "Krom"));
  assert.match(e, /Çakışma/);
  assert.match(e, /Krom \/ 45 x 25/);
  assert.match(e, /Bej \/ 45 x 25|Krom \/ 45 x 25/);
  // Çakışma yoksa (farklı ebat) geçer
  ok(planBulkColor([V("1", "Bej / 45 x 25"), V("2", "Krom / 50 x 50")], "Bej", "Krom"));
});

test("planBulkColor: yeni renk tanınmıyorsa yalnızca bilgi; tür Renk olur, filtre okur", () => {
  const p = ok(planBulkColor(set, "Bej", "Zümrüt"));
  assert.deepEqual(p.warnings, []);
  assert.deepEqual(p.notes, ["Bu renk filtreye otomatik eklenir."]);
  assert.ok(p.changes.every((c) => c.type === "Renk" && c.attrs.c.n === "Zümrüt"));
  assert.deepEqual(ok(planBulkColor([V("1", "Bej", "Renk")], "Bej", "Zümrüt")).warnings, []);
  assert.deepEqual(ok(planBulkColor(set, "Bej", "Gold")).notes, []);
});

test("planBulkColor: tek transaction mantığı — plan saf, girdiyi değiştirmez, hata varsa hiç değişiklik üretmez", () => {
  const snap = JSON.stringify(set);
  err(planBulkColor(set, "Bej", "Krom"));
  assert.equal(JSON.stringify(set), snap);
  const good = ok(planBulkColor(set, "Bej", "Gold"));
  assert.equal(new Set(good.changes.map((c) => c.id)).size, good.changes.length);
});

// ---- Renk filtresi: izin listesi dışı renk, tekilleştirme, pasif ürün ----
import { applyListing, parseListingParams, variationAttrs } from "../lib/listing-core.ts";

const CATS = [{ key: "kristal", slug: "kristal", title: "Kristal" }];
const row = (id, type, values, extra = {}) => ({ id, cat: "kristal", price: 100, created: 1, updated: 1, featured: false, active: true, vars: values.map((v) => variationAttrs(type, v)), ...extra });
const colorsOf = (rows) => applyListing(rows, parseListingParams({}), { cats: CATS }).facets.colors;

test("renk filtresi: izin listesinde olmayan renk (adı düzenlenmiş Seçenek ürünü) filtrede görünür", () => {
  const plan = ok(planRename("Günışığı / 45 x 25", ctx()));
  const rows = [row("a", plan.type, [plan.value, "Krom"]), row("b", "Seçenek", ["Bej"])];
  const names = colorsOf(rows).map((c) => c.name).sort();
  assert.deepEqual(names, ["Bej", "Günışığı", "Krom"]);
  // Seçilince ürünü bulur
  const r = applyListing(rows, parseListingParams({ renk: "gunisigi" }), { cats: CATS });
  assert.deepEqual(r.ids, ["a"]);
});

test("renk filtresi: aynı renk farklı yazımla (büyük/küçük, Türkçe harf) iki kez çıkmaz", () => {
  const rows = [row("a", "Renk", ["Günışığı"]), row("b", "Renk", ["GÜNIŞIĞI / 9 x 14"]), row("c", "Renk", ["günışığı"])];
  const cs = colorsOf(rows);
  assert.equal(cs.length, 1);
  assert.equal(cs[0].count, 3);
});

test("renk filtresi: pasif ürünün rengi filtreye girmez; aktif ürününki girer", () => {
  const rows = [row("a", "Renk", ["Günışığı"], { active: false }), row("b", "Renk", ["Bej"]), row("c", "Renk", ["Bej"], { active: false })];
  const cs = colorsOf(rows);
  assert.deepEqual(cs.map((c) => [c.name, c.count]), [["Bej", 1]]);
});
