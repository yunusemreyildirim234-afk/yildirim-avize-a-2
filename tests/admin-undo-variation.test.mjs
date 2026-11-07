import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXTAUTH_SECRET = "unit-test-secret-not-for-production";
const { signSession, verifySession } = await import("../lib/session.ts");
const { variationUndoEntry, isUndoValue } = await import("../lib/undo-variation.ts");

const st = (o = {}) => ({ id: "var_12345678", stock: 5, extraPrice: 0, variationValue: "Bej / 45 x 25", ...o });

test("yalnızca ad değiştiyse girdi eski adı taşır; stok/fiyat alanları yazılmaz", () => {
  const e = variationUndoEntry(st(), st({ variationValue: "Krom / 45 x 25" }));
  assert.deepEqual(e, { id: "var_12345678", variationValue: "Bej / 45 x 25" });
});

test("mevcut stok/fiyat geri alma davranışı aynı (ad değişmediyse variationValue yok)", () => {
  assert.deepEqual(variationUndoEntry(st(), st({ stock: 8 })), { id: "var_12345678", stockDelta: 3 });
  assert.deepEqual(variationUndoEntry(st(), st({ extraPrice: 20 })), { id: "var_12345678", extraPrice: 0 });
  assert.equal(variationUndoEntry(st(), st()), null);
  assert.deepEqual(variationUndoEntry(st(), st({ stock: 1, extraPrice: 9, variationValue: "X" })), { id: "var_12345678", stockDelta: -4, extraPrice: 0, variationValue: "Bej / 45 x 25" });
});

test("Türkçe karakterli eski ad imzalı belirteçte bozulmadan gidip gelir", async () => {
  const old = "Şeffaf / 28 x 4 — İğdır Çiçeği ığüşöç";
  const entry = variationUndoEntry(st({ variationValue: old }), st({ variationValue: "Krom" }));
  const token = await signSession({ kind: "undo", iat: Date.now(), variations: [entry] });
  const back = await verifySession(token);
  assert.equal(back.variations[0].variationValue, old);
  assert.equal(isUndoValue(back.variations[0].variationValue), true);
});

test("geçersiz eski ad (boş, çok uzun, metin değil) reddedilir", () => {
  for (const v of ["", "   ", "x".repeat(201), 5, null, {}]) assert.equal(isUndoValue(v), false);
  assert.equal(isUndoValue("x".repeat(200)), true);
});
