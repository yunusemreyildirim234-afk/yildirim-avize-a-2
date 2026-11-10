import test from "node:test";
import assert from "node:assert/strict";
import { bankPaymentDeadline, formatIstanbul, orderBreakdown } from "../lib/order-display.ts";
import { BANK_ORDER_HOLD_HOURS } from "../lib/stock-rules.ts";

test("son ödeme = sipariş + BANK_ORDER_HOLD_HOURS", () => {
  const c = new Date("2026-11-10T10:00:00Z");
  assert.equal(bankPaymentDeadline(c).getTime() - c.getTime(), BANK_ORDER_HOLD_HOURS * 3_600_000);
});

test("İstanbul saatiyle biçimlenir (UTC+3)", () => {
  const s = formatIstanbul(new Date("2026-11-10T10:00:00Z"));
  assert.match(s, /13[.:]00/);
  assert.match(s, /Kasım/);
});

test("tutar dökümü indirim farkını verir, negatif olmaz", () => {
  assert.deepEqual(orderBreakdown(1000, 100, 1045), { itemsSum: 1000, shipping: 100, discount: 55, total: 1045 });
  assert.equal(orderBreakdown(1000, 0, 1000).discount, 0);
  assert.equal(orderBreakdown(100, 0, 120).discount, 0);
});
