import test from "node:test";
import assert from "node:assert/strict";
import { CART_CHOICES_KEY, clearCartChoices, loadCartChoices, parseCartChoices, saveCartChoices } from "../lib/cart-choices.ts";

const mem = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

test("kaydet / geri yükle / temizle", () => {
  const s = mem();
  saveCartChoices(s, { coupon: "YAZ10", paymentMethod: "BANK_TRANSFER" });
  assert.deepEqual(loadCartChoices(s), { coupon: "YAZ10", paymentMethod: "BANK_TRANSFER" });
  clearCartChoices(s);
  assert.deepEqual(loadCartChoices(s), { coupon: "", paymentMethod: null });
});

test("bozuk veya geçersiz içerik boş seçime döner", () => {
  assert.deepEqual(parseCartChoices("{bozuk"), { coupon: "", paymentMethod: null });
  assert.deepEqual(parseCartChoices(JSON.stringify({ coupon: 5, paymentMethod: "NAKIT" })), { coupon: "", paymentMethod: null });
  assert.deepEqual(parseCartChoices(null), { coupon: "", paymentMethod: null });
});

test("depolama hata fırlatsa da çökmez", () => {
  const bad = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); }, removeItem() { throw new Error("x"); } };
  assert.deepEqual(loadCartChoices(bad), { coupon: "", paymentMethod: null });
  saveCartChoices(bad, { coupon: "A", paymentMethod: null });
  clearCartChoices(bad);
  assert.deepEqual(loadCartChoices(null), { coupon: "", paymentMethod: null });
  assert.ok(CART_CHOICES_KEY);
});
