import test from "node:test";
import assert from "node:assert/strict";
import { applyNameUpdates, refreshedName } from "../lib/cart-names.ts";

test("refreshedName: tür öneki korunur, öneksiz kayıt öneksiz kalır", () => {
  assert.equal(refreshedName("Seçenek: Bej", "Krem"), "Seçenek: Krem");
  assert.equal(refreshedName("Renk:   Bej", "Krem"), "Renk:   Krem");
  assert.equal(refreshedName("Bej", "Krem"), "Krem");
  assert.equal(refreshedName("Krom / 45 x 25", "Krom / 58 x 58"), "Krom / 58 x 58");
});

test("refreshedName: ad değişmediyse aynen döner", () => {
  assert.equal(refreshedName("Seçenek: Bej", "Bej"), "Seçenek: Bej");
  assert.equal(refreshedName("Bej", "Bej"), "Bej");
  assert.equal(refreshedName("Bej", "  Bej "), "Bej");
  assert.equal(refreshedName("Krom: 45", "Krom: 45"), "Krom: 45"); // ad iki nokta içeriyorsa önek sanılmaz
  assert.equal(refreshedName("Bej", ""), "Bej"); // boş sunucu adı kaydı bozmaz
});

test("applyNameUpdates: değişen yoksa AYNI dizi (render/localStorage yazımı yok); değişen varsa yalnızca o satır", () => {
  const cart = [
    { variationId: "a", variationName: "Seçenek: Bej", price: 1 },
    { variationId: "b", variationName: "Krom", price: 2 },
  ];
  assert.equal(applyNameUpdates(cart, [{ variationId: "a", variationName: "Bej" }, { variationId: "b", variationName: "Krom" }, { variationId: "z", variationName: "X" }]), cart);
  const next = applyNameUpdates(cart, [{ variationId: "a", variationName: "Krem" }]);
  assert.notEqual(next, cart);
  assert.equal(next[0].variationName, "Seçenek: Krem");
  assert.equal(next[1], cart[1]); // dokunulmayan satır aynı nesne
  assert.equal(cart[0].variationName, "Seçenek: Bej"); // girdi değişmez
  assert.equal(next[0].price, 1); // fiyat/adet alanlarına dokunulmaz
});
