import test from "node:test";
import assert from "node:assert/strict";
import { applyImageMaps, imageMapOf, mapImages } from "../lib/image-map.ts";
import { planSync } from "../lib/trendyol-plan.ts";

const T1 = "https://cdn.dsmcdn.com/ty1/a.jpg";
const T2 = "https://cdn.dsmcdn.com/ty1/b.jpg";
const T3 = "https://cdn.dsmcdn.com/ty1/c.jpg";
const B1 = "https://abc.public.blob.vercel-storage.com/urun/p1/aaa-kr-b.webp";
const B2 = "https://abc.public.blob.vercel-storage.com/urun/p1/bbb-kr-b.webp";
const MAP = { [T1]: B1, [T2]: B2 };

const modes = (images) => ({ STOCK: "SKIP", PRICE: "SKIP", TEXT: "SKIP", IMAGES: images, CATEGORY: "SKIP", VARIANT_INFO: "SKIP", ACTIVE: "SKIP" });
const base = { title: "Avize", description: null, category: "Kristal", basePrice: 100, listPrice: null, active: true, brand: null, trendyolCategory: null, trendyolUrl: null };
const existing = (images, syncSnapshot) => ({ id: "p1", trendyolMainId: "M1", ...base, images, syncSnapshot, variations: [] });
const incoming = (images) => ({ mainId: "M1", ...base, images, variations: [] });
const imagesField = (plan) => plan.products[0]?.fields.find((f) => f.alan === "images");

test("imageMapOf: yok/bozuk kayıt boş eşleme verir, yalnızca metin çiftleri alınır", () => {
  for (const s of [null, undefined, "x", [], {}, { imageMap: null }, { imageMap: [] }, { imageMap: "x" }]) assert.deepEqual(imageMapOf(s), {});
  assert.deepEqual(imageMapOf({ imageMap: { [T1]: B1, [T2]: 5, [T3]: "" } }), { [T1]: B1 });
});

test("mapImages: eşlemedeki adres çevrilir, olmayan aynen kalır, tekilleştirilir", () => {
  assert.deepEqual(mapImages([T1, T3, T2, T1], MAP), [B1, T3, B2]);
});

test("eşlemesi olmayan üründe hiçbir şey değişmez", () => {
  const inc = [incoming([T1, T2])];
  const ex = [existing([T1, T2], { images: [T1, T2] })];
  const r = applyImageMaps(inc, ex);
  assert.deepEqual(r.incoming, inc);
  assert.deepEqual(r.existing, ex);
});

test("çevirme OLMADAN Ezerek, kopyalanmış adresleri Trendyol adresiyle geri ezer (düzeltilen hata)", () => {
  const plan = planSync([existing([B1, B2], { images: [T1, T2], imageMap: MAP })], [incoming([T1, T2])], modes("OVERWRITE"), {});
  assert.equal(imagesField(plan).karar, "EZİLECEK");
});

for (const mode of ["OVERWRITE", "KEEP"]) {
  test(`çevirmeyle ${mode}: değişmeyen görseller AYNI, hiçbir değer yazılmaz`, () => {
    const r = applyImageMaps([incoming([T1, T2])], [existing([B1, B2], { images: [T1, T2], imageMap: MAP })]);
    const plan = planSync(r.existing, r.incoming, modes(mode), {});
    assert.equal(imagesField(plan), undefined);
    assert.deepEqual(plan.products[0].write?.data ?? {}, {});
  });

  test(`çevirmeyle ${mode}: Trendyol'a eklenen yeni görsel eklenir, kopyalar yerinde kalır, imageMap korunur`, () => {
    const r = applyImageMaps([incoming([T1, T2, T3])], [existing([B1, B2], { images: [T1, T2], imageMap: MAP })]);
    const plan = planSync(r.existing, r.incoming, modes(mode), {});
    const p = plan.products[0];
    assert.equal(imagesField(plan).karar, "EZİLECEK");
    assert.deepEqual(p.write.data.images, [B1, B2, T3]);
    assert.equal(p.write.data.imageUrl, B1);
    assert.deepEqual(p.write.snapshot.imageMap, MAP);
    assert.deepEqual(p.write.snapshot.images, [B1, B2, T3]);
  });
}

test("Dokunma (varsayılan): görsellere dokunulmaz", () => {
  const r = applyImageMaps([incoming([T1, T2, T3])], [existing([B1, B2], { imageMap: MAP })]);
  const plan = planSync(r.existing, r.incoming, modes("SKIP"), {});
  assert.equal(plan.products[0]?.write ?? null, null);
});

test("anlık görüntüsü yalnızca imageMap olan üründe (önceden boştu) KEEP eskisi gibi davranır", () => {
  const r = applyImageMaps([incoming([T1, T2])], [existing([B1, B2], { imageMap: MAP })]);
  const plan = planSync(r.existing, r.incoming, modes("KEEP"), {});
  assert.equal(imagesField(plan), undefined);
  assert.deepEqual(plan.products[0].write.snapshot.imageMap, MAP);
});
