import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { heldCouponUses, shouldPlanSwapForQuote, stockWithHeld } from "../lib/order-swap.ts";
import { planPendingCleanup } from "../lib/pending-orders.ts";

const OLD = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-2222-4333-8444-555555555555";

// Tek adetlik ürün: son adet müşterinin ödenmemiş kartlı siparişinde ayrılı → boş stok 0
const freeStock = { v1: 0 };
const pending = [
  { id: OLD, phone: "05551112233", userId: "g1", user: { email: "ali+misafirab12@x.com", password: "guest_checkout" }, couponCode: "TEK", items: [{ variationId: "v1", quantity: 1 }] },
  { id: OTHER, phone: "05320000000", userId: "U9", user: { email: "veli@x.com", password: "hash" }, couponCode: null, items: [{ variationId: "v1", quantity: 3 }] },
];

// /api/cart/quote akışı: lib/orders.ts planPendingSwap'in veritabanı kısmı bellek içi satırlarla; karar kuralı (planPendingCleanup) gerçek koddur
function quote({ qty = 1, paymentMethod = "CREDIT_CARD", email = "", sessionUserId = null, previousOrderId = undefined }) {
  const held = new Map();
  let heldCoupons = [];
  if (shouldPlanSwapForQuote({ paymentMethod, sessionUserId, previousOrderId })) {
    const plan = planPendingCleanup(pending, { email, phone: "", sessionUserId, previousOrderId });
    for (const o of pending.filter((p) => plan.swapIds.includes(p.id))) {
      heldCoupons.push(o.couponCode);
      for (const i of o.items) held.set(i.variationId, (held.get(i.variationId) ?? 0) + i.quantity);
    }
  }
  const stock = stockWithHeld(freeStock.v1, held, "v1");
  return { stock, stockShort: stock < qty, couponHeld: heldCouponUses("TEK", heldCoupons) };
}

test("teklif: tek adetlik üründe 'geri dön, tekrar dene' (aynı tarayıcı + aynı e-posta): kendi siparişinin tuttuğu stok ve kupon lehine sayılır", () => {
  const q = quote({ email: "Ali@X.com", previousOrderId: OLD });
  assert.deepEqual(q, { stock: 1, stockShort: false, couponHeld: 1 });
  assert.equal(quote({ qty: 2, email: "ali@x.com", previousOrderId: OLD }).stockShort, true, "tuttuğundan fazlası hâlâ yetersiz");
});

test("teklif: kimliği bilinmeyen misafirde sayılmaz (e-posta eşleşse bile)", () => {
  assert.deepEqual(quote({ email: "ali@x.com" }), { stock: 0, stockShort: true, couponHeld: 0 });
  assert.deepEqual(quote({ email: "ali@x.com", previousOrderId: "uydurma" }), { stock: 0, stockShort: true, couponHeld: 0 }, "geçersiz kimlik kimlik sayılmaz");
});

test("teklif: başkasının siparişinin stoğu sayılmaz (kimlik bilinse de e-posta/hesap başkasının)", () => {
  assert.equal(quote({ email: "ali@x.com", previousOrderId: OTHER }).stock, 0, "kimlik biliniyor, e-posta başkasının");
  assert.equal(quote({ email: "veli@x.com", previousOrderId: OTHER }).stock, 0, "kayıtlı hesabın siparişi oturumsuz sayılmaz");
  assert.equal(quote({ previousOrderId: OLD }).stock, 0, "e-posta yazılmadan misafir siparişi sayılmaz");
  assert.equal(quote({ email: "ali@x.com", sessionUserId: "U1", previousOrderId: OLD }).stock, 0, "oturum varken sahiplik userId ile: başka kullanıcının (misafir kaydının) siparişi sayılmaz");
});

test("teklif: oturumdaki kullanıcının kendi bekleyen siparişi kimlik gönderilmeden de sayılır", () => {
  assert.deepEqual(quote({ sessionUserId: "U9" }), { stock: 3, stockShort: false, couponHeld: 0 });
});

test("teklif: havale seçiliyken sayılmaz (sipariş ucu yalnızca kartlı siparişte eskiyi değiştirir)", () => {
  assert.equal(quote({ paymentMethod: "BANK_TRANSFER", email: "ali@x.com", previousOrderId: OLD }).stockShort, true);
  assert.equal(shouldPlanSwapForQuote({ paymentMethod: "CREDIT_CARD" }), false, "kimlik kanıtı yokken plan aranmaz");
  assert.equal(shouldPlanSwapForQuote({ paymentMethod: "CREDIT_CARD", previousOrderId: OLD }), true);
  assert.equal(shouldPlanSwapForQuote({ paymentMethod: "CREDIT_CARD", sessionUserId: "U1" }), true);
});

test("teklif ucu sipariş ucuyla aynı planı kullanır, hiçbir şey yazmaz; sepet previousOrderId'yi teklif isteğine ekler", () => {
  const route = readFileSync(new URL("../app/api/cart/quote/route.ts", import.meta.url), "utf8");
  assert.match(route, /shouldPlanSwapForQuote\(\{ paymentMethod, sessionUserId: userId, previousOrderId: body\.previousOrderId \}\)/);
  assert.match(route, /planPendingSwap\(\{[^}]*previousOrderId: body\.previousOrderId \}\)/);
  assert.match(route, /replacing: \{ orderIds: swap\.swapIds, couponCodes: swap\.heldCoupons \}/);
  assert.match(route, /stockShort: stockWithHeld\(usable\[i\]\.v\.stock, swap\.heldStock, l\.variationId\) < l\.quantity/);
  assert.ok(!/swapAndCreate|closeAwaitingCardInTx|failAwaitingCardOrder|\.update\(|\.updateMany\(|\.create\(|\.delete/.test(route), "teklif ucu salt okunur kalmalı");
  const cart = readFileSync(new URL("../app/sepet/page.tsx", import.meta.url), "utf8");
  assert.match(cart, /const prevOrderId = previousCardOrderId\(\);/);
  assert.match(cart, /\.\.\.\(prevOrderId \? \{ previousOrderId: prevOrderId \} : \{\}\)/);
  // Sipariş ucundaki stok kontrolü de aynı toplamı kullanır
  assert.match(readFileSync(new URL("../app/api/order/route.ts", import.meta.url), "utf8"), /isShort\(variation\.stock \+ held, wanted\)/);
});
