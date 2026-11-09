import test from "node:test";
import assert from "node:assert/strict";
import { BANK_ORDER_HOLD_HOURS, shouldCancelUnpaidBank } from "../lib/stock-rules.ts";
import { bankPendingBlocked } from "../lib/pending-orders.ts";

const T0 = Date.parse("2026-11-04T10:00:00Z");
const HOUR = 3_600_000;
const bank = (over = {}) => ({ status: "PENDING_NEW", paymentMethod: "BANK_TRANSFER", receiptUrl: null, createdAt: new Date(T0), ...over });
const row = (email, phone) => ({ phone, user: { email } });

test("havale otomatik iptal süresi 48 saat; sınırda iptal yok, sonrasında var", () => {
  assert.equal(BANK_ORDER_HOLD_HOURS, 48);
  assert.equal(shouldCancelUnpaidBank(bank(), T0 + 48 * HOUR), false);
  assert.equal(shouldCancelUnpaidBank(bank(), T0 + 48 * HOUR + 1), true);
});

test("dekont yüklenmiş, kartlı veya onaylanmış sipariş iptal edilmez", () => {
  const late = T0 + 100 * HOUR;
  assert.equal(shouldCancelUnpaidBank(bank({ receiptUrl: "/api/receipts/x" }), late), false);
  assert.equal(shouldCancelUnpaidBank(bank({ paymentMethod: "CREDIT_CARD" }), late), false);
  assert.equal(shouldCancelUnpaidBank(bank({ status: "PENDING" }), late), false);
});

test("havale bekleyen sınırı: aynı e-posta veya telefonla iki bekleyen sipariş yenisini engeller", () => {
  const phone = "0555 111 22 33";
  assert.equal(bankPendingBlocked([row("a@x.com", "0532 000 00 00")], { email: "a@x.com", phone }), false);
  assert.equal(bankPendingBlocked([row("a@x.com", "0532 000 00 00"), row("A+misafirabc@x.com", "0532 000 00 01")], { email: "a@x.com", phone }), true, "+misafir etiketi aynı e-posta sayılır");
  assert.equal(bankPendingBlocked([row("b@x.com", phone), row("c@x.com", "+90 555 111 22 33")], { email: "a@x.com", phone }), true, "telefon son 10 haneyle eşleşir");
  assert.equal(bankPendingBlocked([row("b@x.com", phone), row("c@x.com", phone)], { email: "a@x.com", phone: "0532 999 99 99" }), false, "başka iletişim bilgisi etkilenmez");
});
