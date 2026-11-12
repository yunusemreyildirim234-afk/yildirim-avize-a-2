import test from "node:test";
import assert from "node:assert/strict";
import { editorStateOf, stockSaveBody } from "../lib/editor-dirty.ts";
import { planStockWrite } from "../lib/stock-edit.ts";

const product = (o = {}) => ({
  title: "Avize",
  basePrice: 1000,
  modelCode: "M1",
  ebat: null,
  imageUrl: "/a.webp",
  images: ["/a.webp", "/b.webp"],
  isFeatured: false,
  isBestSeller: true,
  variations: [
    { id: "v1", stock: 5, extraPrice: 0, images: ["/k1.webp"] },
    { id: "v2", stock: 2, extraPrice: 150, images: [] },
  ],
  ...o,
});

test("editorStateOf: ürün form karşılığına çevrilir; görsel yoksa kapak tek görsel olur", () => {
  const s = editorStateOf(product());
  assert.deepEqual(s.info, { title: "Avize", basePrice: "1000", modelCode: "M1", ebat: "", isFeatured: false, isBestSeller: true });
  assert.deepEqual(s.images, ["/a.webp", "/b.webp"]);
  assert.deepEqual(s.vars, { v1: { stock: "5", extraPrice: "0" }, v2: { stock: "2", extraPrice: "150" } });
  assert.deepEqual(s.varImages, { v1: ["/k1.webp"], v2: [] });
  assert.deepEqual(s.order, ["v1", "v2"]);
  assert.deepEqual(editorStateOf(product({ images: [], imageUrl: "/kapak.webp" })).images, ["/kapak.webp"]);
});

test("stok kaydı: prevStock formun açıldığı andaki tabandan gider", () => {
  const base = editorStateOf(product()).vars.v1;
  assert.deepEqual(stockSaveBody("v1", base, { stock: "8", extraPrice: "20" }), { variationId: "v1", stock: 8, prevStock: 5, extraPrice: 20 });
});

test("stok ezme koruması: arada sipariş stoğu düşürdüyse eski form değeri yazılamaz", () => {
  // Form 5 ile açıldı; yönetici yalnızca ek fiyatı değiştirdi (stok alanı hâlâ 5). Arada sipariş geldi: veritabanı 3.
  const base = editorStateOf(product()).vars.v1;
  const form = { stock: "5", extraPrice: "20" };
  const body = stockSaveBody("v1", base, form);
  // Sunucu kuralı: form değeri tabanla aynı → stok HİÇ yazılmaz (rezervasyon korunur).
  assert.deepEqual(planStockWrite(body.stock, body.prevStock), { kind: "SKIP" });

  // Taban yerine yenilenmiş canlı değer (3) gönderilseydi sunucu 3 → 5 yazardı; bu test o geri dönüşü yakalar.
  const live = editorStateOf(product({ variations: [{ id: "v1", stock: 3, extraPrice: 0 }] })).vars.v1;
  assert.deepEqual(planStockWrite(Number(form.stock), Number(live.stock)), { kind: "CAS", expected: 3, next: 5 });
  assert.notEqual(body.prevStock, Number(live.stock));
});

test("stok ezme koruması: yönetici stoğu değiştirdiyse yazım tabana koşullanır (veritabanı farklıysa sunucu reddeder)", () => {
  const base = editorStateOf(product()).vars.v1;
  const body = stockSaveBody("v1", base, { stock: "9", extraPrice: "0" });
  assert.deepEqual(planStockWrite(body.stock, body.prevStock), { kind: "CAS", expected: 5, next: 9 });
});

// ---------- Kirli parçalar, kayıt planı, uzlaştırma ----------
const { dirtyOf, isDirty, dirtyLabels, hasNoUndoParts, validateDirty, savePlan, commitStep, reconcile, resultSummary } = await import("../lib/editor-dirty.ts");
const clone = (s) => structuredClone(s);
const nameOf = (id) => ({ v1: "Krom", v2: "Gold", v3: "Siyah" })[id] ?? id;

test("değişiklik yoksa kirli değil, plan boş", () => {
  const base = editorStateOf(product());
  const d = dirtyOf(base, clone(base));
  assert.equal(isDirty(d), false);
  assert.deepEqual(dirtyLabels(d), []);
  assert.deepEqual(savePlan("p1", base, clone(base), nameOf), []);
});

test("kirli parçalar ayrı ayrı bulunur ve etiketlenir", () => {
  const base = editorStateOf(product());
  const form = clone(base);
  form.info.title = "Yeni";
  form.images.reverse();
  form.vars.v2.stock = "7";
  form.varImages.v1.push("/k2.webp");
  form.order.reverse();
  const d = dirtyOf(base, form);
  assert.deepEqual(d, { info: true, images: true, vars: ["v2"], varImages: ["v1"], order: true });
  assert.deepEqual(dirtyLabels(d), ["Bilgiler", "Genel fotoğraflar", "Renkler (1)", "Renk fotoğrafları (1)", "Renk sırası"]);
  assert.equal(hasNoUndoParts(d), true);
  assert.equal(hasNoUndoParts({ ...d, varImages: [], order: false }), false);
});

test("plan: sıra bilgiler → renk satırları → renk fotoğrafları → renk sırası; yalnızca mevcut iki uç", () => {
  const base = editorStateOf(product());
  const form = clone(base);
  form.info.basePrice = "1200";
  form.vars.v1.stock = "9";
  form.vars.v2.extraPrice = "200";
  form.varImages.v2 = ["/g.webp"];
  form.order = ["v2", "v1"];
  const steps = savePlan("p1", base, form, nameOf);
  assert.deepEqual(steps.map((s) => s.key), ["info", "var:v2", "var:v1", "varImages:v2", "order"]);
  assert.deepEqual([...new Set(steps.map((s) => `${s.method} ${s.url}`))], ["PATCH /api/admin/product", "PATCH /api/admin/product/variation"]);
  assert.deepEqual(steps[0].body, { productId: "p1", title: "Avize", basePrice: 1200, modelCode: "M1", ebat: "", images: ["/a.webp", "/b.webp"], isFeatured: false, isBestSeller: true });
  assert.equal(steps[0].label, "Bilgiler");
  assert.deepEqual(steps[1].body, { variationId: "v2", stock: 2, prevStock: 2, extraPrice: 200 }); // stok değişmedi: sunucu yazmaz
  assert.deepEqual(steps[2].body, { variationId: "v1", stock: 9, prevStock: 5, extraPrice: 0 });
  assert.deepEqual(steps[3].body, { variationId: "v2", images: ["/g.webp"] });
  assert.deepEqual(steps[4].body, { productId: "p1", order: ["v2", "v1"] });
  assert.deepEqual(steps.map((s) => s.undoable), [true, true, true, false, false]);
});

test("plan etiketi: yalnızca fotoğraf ya da ikisi birden", () => {
  const base = editorStateOf(product());
  const f1 = clone(base);
  f1.images.pop();
  assert.equal(savePlan("p1", base, f1, nameOf)[0].label, "Genel fotoğraflar");
  f1.info.ebat = "45 x 25";
  assert.equal(savePlan("p1", base, f1, nameOf)[0].label, "Bilgiler ve genel fotoğraflar");
});

test("kısmi başarısızlık: başarılı adım tabana işlenir, başarısız parça kirli kalır", () => {
  let base = editorStateOf(product());
  const form = clone(base);
  form.info.title = "Yeni";
  form.vars.v1.stock = "9";
  form.order = ["v2", "v1"];
  const steps = savePlan("p1", base, form, nameOf);
  // info ve order başarılı, v1 stok başarısız (409)
  for (const s of steps) if (s.key !== "var:v1") base = commitStep(base, form, s);
  assert.deepEqual(dirtyOf(base, form), { info: false, images: false, vars: ["v1"], varImages: [], order: false });
  // Yeniden "Tümünü kaydet" yalnızca kalan adımı gönderir; prevStock hâlâ eski taban
  const again = savePlan("p1", base, form, nameOf);
  assert.deepEqual(again.map((s) => s.key), ["var:v1"]);
  assert.equal(again[0].body.prevStock, 5);
});

test("doğrulama: yalnızca kirli parçalar; boş başlık, geçersiz fiyat/stok/ek fiyat", () => {
  const base = editorStateOf(product());
  const form = clone(base);
  form.info.title = "  ";
  form.info.basePrice = "-1";
  form.vars.v1.stock = "1.5";
  form.vars.v2.extraPrice = "";
  const errs = validateDirty(form, dirtyOf(base, form), nameOf);
  assert.equal(errs.length, 4);
  assert.match(errs[2], /^Krom: stok/);
  assert.match(errs[3], /^Gold: ek fiyat/);
  const ok = clone(base);
  ok.vars.v1.stock = "0";
  assert.deepEqual(validateDirty(ok, dirtyOf(base, ok), nameOf), []);
  const big = clone(base);
  big.vars.v1.stock = "100000";
  assert.equal(validateDirty(big, dirtyOf(base, big), nameOf).length, 1);
});

test("uzlaştırma: kirli olmayan parçalar sunucu değerini alır", () => {
  const base = editorStateOf(product());
  const server = editorStateOf(product({ title: "Sunucu", variations: [{ id: "v1", stock: 3, extraPrice: 0, images: ["/k1.webp"] }, { id: "v2", stock: 2, extraPrice: 150, images: [] }] }));
  const r = reconcile(base, clone(base), server);
  assert.deepEqual(r.base, server);
  assert.deepEqual(r.form, server);
});

test("uzlaştırma: kirli stok satırı ve tabanı korunur (arada stok değiştiyse kayıt tabana koşullu kalır)", () => {
  const base = editorStateOf(product());
  const form = clone(base);
  form.vars.v1.stock = "9";
  form.info.title = "Taslak";
  const server = editorStateOf(product({ variations: [{ id: "v1", stock: 3, extraPrice: 0, images: ["/k1.webp"] }, { id: "v2", stock: 1, extraPrice: 150, images: [] }] }));
  const r = reconcile(base, form, server);
  assert.deepEqual(r.form.vars.v1, { stock: "9", extraPrice: "0" });
  assert.deepEqual(r.base.vars.v1, { stock: "5", extraPrice: "0" }); // taban eski: prevStock 5 → sunucu (3) reddeder
  assert.deepEqual(r.form.vars.v2, { stock: "1", extraPrice: "150" }); // kirli değildi: sunucu değeri
  assert.equal(r.form.info.title, "Taslak");
  assert.equal(savePlan("p1", r.base, r.form, nameOf).find((s) => s.key === "var:v1").body.prevStock, 5);
});

test("uzlaştırma: silinen renk düşer, yeni renk eklenir; kirli sıra korunup yeni renk sona gelir", () => {
  const base = editorStateOf(product());
  const form = clone(base);
  form.order = ["v2", "v1"];
  form.vars.v1.stock = "8";
  const server = editorStateOf(product({ variations: [{ id: "v2", stock: 2, extraPrice: 150, images: [] }, { id: "v3", stock: 4, extraPrice: 0, images: [] }] }));
  const r = reconcile(base, form, server);
  assert.deepEqual(r.form.order, ["v2", "v3"]);
  assert.deepEqual(r.base.order, ["v2", "v3"]);
  assert.deepEqual(Object.keys(r.form.vars), ["v2", "v3"]);
  assert.deepEqual(r.form.vars.v3, { stock: "4", extraPrice: "0" });
  assert.equal(isDirty(dirtyOf(r.base, r.form)), false);
});

test("sonuç özeti", () => {
  assert.equal(resultSummary(3, []), "✓ 3 kayıt kaydedildi.");
  assert.equal(resultSummary(2, [{ label: "Krom stok/ek fiyat", error: "Stok değişti." }]), "2 kayıt kaydedildi, 1 başarısız. Krom stok/ek fiyat: Stok değişti.");
});
