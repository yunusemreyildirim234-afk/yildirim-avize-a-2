import test from "node:test";
import assert from "node:assert/strict";
import { canViewOrderDetails, GUEST_ORDER_WINDOW_MS, isGuestOrderWindowOpen } from "../lib/order-access.ts";

const T0 = Date.parse("2026-11-04T10:00:00Z");
const createdAt = new Date(T0);
const guest = { userId: "g1", isGuest: true, createdAt };
const member = { userId: "u1", isGuest: false, createdAt };
const fresh = T0 + 60_000;
const expired = T0 + GUEST_ORDER_WINDOW_MS + 1;

test("misafir penceresi 24 saat, sınır dahil değil", () => {
  assert.equal(GUEST_ORDER_WINDOW_MS, 86_400_000);
  assert.equal(isGuestOrderWindowOpen(createdAt, T0 + GUEST_ORDER_WINDOW_MS - 1), true);
  assert.equal(isGuestOrderWindowOpen(createdAt, T0 + GUEST_ORDER_WINDOW_MS), false);
});

test("misafir siparişi: ilk 24 saatte herkes, sonra kimse", () => {
  assert.equal(canViewOrderDetails(guest, null, fresh), true);
  assert.equal(canViewOrderDetails(guest, null, expired), false);
  assert.equal(canViewOrderDetails(guest, "u9", expired), false);
});

test("üye siparişi: yalnızca oturumlu sahibi, süreden bağımsız", () => {
  assert.equal(canViewOrderDetails(member, "u1", expired), true);
  assert.equal(canViewOrderDetails(member, null, fresh), false, "üye siparişinde misafir penceresi yok");
  assert.equal(canViewOrderDetails(member, "u9", fresh), false);
});
