import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { listSignature, sameCartRows, sameIdSet } from "../lib/list-sync.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("imza: aynı içerik (sıra farklı olsa da) eşit; adet ya da eleman değişince farklı", () => {
  const a = [{ variationId: "v1", quantity: 1 }, { variationId: "v2", quantity: 2 }];
  assert.equal(listSignature(a), listSignature([a[1], a[0]]));
  assert.notEqual(listSignature(a), listSignature([{ variationId: "v1", quantity: 2 }, a[1]]));
  assert.notEqual(listSignature(a), listSignature([a[0]]));
  assert.equal(listSignature([]), listSignature([]));
});

test("sepet satırları: aynı eşleme eşit; adet/kimlik/uzunluk farkı eşit değil", () => {
  const s = [{ variationId: "a", quantity: 1 }, { variationId: "b", quantity: 3 }];
  assert.equal(sameCartRows(s, [s[1], s[0]]), true);
  assert.equal(sameCartRows(s, [{ variationId: "a", quantity: 2 }, s[1]]), false);
  assert.equal(sameCartRows(s, [s[0], { variationId: "c", quantity: 3 }]), false);
  assert.equal(sameCartRows(s, [s[0]]), false);
  assert.equal(sameCartRows([], []), true);
});

test("favori kimlik kümesi: sıra ve tekrar önemsiz", () => {
  assert.equal(sameIdSet(["a", "b"], ["b", "a"]), true);
  assert.equal(sameIdSet(["a", "b"], ["a"]), false);
  assert.equal(sameIdSet([], []), true);
});

test("kablolama: ikisi de PUT'ta karşılaştırır; istemci imzayı ref'te tutar", () => {
  assert.match(read("app/api/cart/route.ts"), /sameCartRows\(stored, next\)/);
  assert.match(read("app/api/favorites/route.ts"), /sameIdSet\(/);
  const h = read("context/useAccountSync.ts");
  assert.match(h, /lastSig = useRef/);
  assert.match(h, /sig === lastSig\.current/);
});
