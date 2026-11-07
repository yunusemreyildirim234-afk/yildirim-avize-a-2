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

test("planRename uyarıları: izin listesinde yok / ebat yok", () => {
  const w1 = ok(planRename("Zümrüt / 45 x 25", ctx())).warnings;
  assert.equal(w1.length, 1);
  assert.match(w1[0], /izin listesinde yok/);
  assert.deepEqual(ok(planRename("Krom / 45 x 25", ctx())).warnings, []);
  // Renk tipi için de aynı uyarı
  assert.match(ok(planRename("Zümrüt / 45 x 25", ctx({ type: "Renk" }))).warnings[0], /izin listesinde yok/);
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

test("planBulkColor: yeni renk tanınmıyorsa uyarı; Renk tipinde de", () => {
  assert.match(ok(planBulkColor(set, "Bej", "Zümrüt")).warnings[0], /izin listesinde yok/);
  assert.match(ok(planBulkColor([V("1", "Bej", "Renk")], "Bej", "Zümrüt")).warnings[0], /izin listesinde yok/);
});

test("planBulkColor: tek transaction mantığı — plan saf, girdiyi değiştirmez, hata varsa hiç değişiklik üretmez", () => {
  const snap = JSON.stringify(set);
  err(planBulkColor(set, "Bej", "Krom"));
  assert.equal(JSON.stringify(set), snap);
  const good = ok(planBulkColor(set, "Bej", "Gold"));
  assert.equal(new Set(good.changes.map((c) => c.id)).size, good.changes.length);
});
