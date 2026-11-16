import test from "node:test";
import assert from "node:assert/strict";
import { avantajGorunsunMu, avantajSurumu, kaydiCoz, GIZLEME_SURESI_MS } from "../lib/promo-dismiss.ts";

const T0 = 1_700_000_000_000;

test("kayıt yok: gösterilir", () => {
  assert.equal(avantajGorunsunMu({ kayit: null, guncelSurum: "a", simdi: T0 }), true);
});
test("aynı sürüm, 24 saatten az: gizli", () => {
  const kayit = { surum: "a", gizlenmeZamani: T0 };
  assert.equal(avantajGorunsunMu({ kayit, guncelSurum: "a", simdi: T0 + GIZLEME_SURESI_MS - 1 }), false);
});
test("aynı sürüm, 24 saat geçti: gösterilir", () => {
  const kayit = { surum: "a", gizlenmeZamani: T0 };
  assert.equal(avantajGorunsunMu({ kayit, guncelSurum: "a", simdi: T0 + GIZLEME_SURESI_MS }), true);
});
test("farklı sürüm: gösterilir", () => {
  const kayit = { surum: "a", gizlenmeZamani: T0 };
  assert.equal(avantajGorunsunMu({ kayit, guncelSurum: "b", simdi: T0 + 1000 }), true);
});
test("gelecekteki zaman damgası (saat geri alındı): gösterilir", () => {
  const kayit = { surum: "a", gizlenmeZamani: T0 + 5000 };
  assert.equal(avantajGorunsunMu({ kayit, guncelSurum: "a", simdi: T0 }), true);
});
test("bozuk kayıt: çözülemez ve gösterilir", () => {
  for (const ham of [null, "", "{", "[]", "5", '{"surum":1,"gizlenmeZamani":2}', '{"surum":"a"}', '{"surum":"a","gizlenmeZamani":"x"}']) {
    const kayit = kaydiCoz(ham);
    assert.equal(kayit, null, String(ham));
    assert.equal(avantajGorunsunMu({ kayit, guncelSurum: "a", simdi: T0 }), true);
  }
  assert.deepEqual(kaydiCoz('{"surum":"a","gizlenmeZamani":5}'), { surum: "a", gizlenmeZamani: 5 });
});
test("sürüm: içerik değişince değişir, aynı içerikte sabit", () => {
  const k = [{ id: "kupon", code: "X", title: "T", text: "%5" }];
  assert.equal(avantajSurumu(k), avantajSurumu([{ ...k[0] }]));
  assert.notEqual(avantajSurumu(k), avantajSurumu([{ ...k[0], code: "Y" }]));
  assert.notEqual(avantajSurumu(k), avantajSurumu([{ ...k[0], text: "%7" }]));
});
