import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { guestCancelAction, guestCancelWaLink } from "../lib/guest-cancel-request.ts";

const g = (status, extra = {}) => guestCancelAction({ status, isOwner: false, ...extra });

test("DELIVERED → iade düğmesi", () => {
  const a = g("DELIVERED");
  assert.equal(a.kind, "whatsapp");
  assert.equal(a.label, "İade için WhatsApp'tan yaz");
  assert.equal(a.message("YA-1"), "Merhaba, YA-1 kodlu siparişim için iade talebinde bulunmak istiyorum.");
});

test("teslim edilmemiş açık siparişler → iptal düğmesi", () => {
  for (const s of ["PENDING_NEW", "AWAITING_PAYMENT", "PROCESSING", "SHIPPED"]) {
    const a = g(s);
    assert.equal(a.kind, "whatsapp", s);
    assert.equal(a.label, "İptal için WhatsApp'tan yaz");
    assert.match(a.message("X"), /iptal talebinde/);
  }
});

test("CANCELLED / RETURNED / PAYMENT_FAILED → yok", () => {
  for (const s of ["CANCELLED", "RETURNED", "PAYMENT_FAILED"]) assert.deepEqual(g(s), { kind: "none" });
});

test("talep varsa → bilgi", () => {
  assert.deepEqual(g("DELIVERED", { cancelReturnStatus: "PENDING" }), { kind: "info", text: "Bu sipariş için talep alınmış, sonuç e-posta ile bildirilir." });
  assert.equal(g("PENDING_NEW", { cancelReturnStatus: "APPROVED" }).kind, "info");
});

test("sahip → yok", () => {
  assert.deepEqual(guestCancelAction({ status: "DELIVERED", isOwner: true }), { kind: "none" });
  assert.deepEqual(guestCancelAction({ status: "PENDING_NEW", isOwner: true, cancelReturnStatus: "PENDING" }), { kind: "none" });
});

test("wa.me bağlantısı kodlanır", () => {
  assert.equal(guestCancelWaLink("905", "a b"), "https://wa.me/905?text=a%20b");
});

test("sayfalar bileşeni kullanır; kargo-takip sahip kimliğini istemciye taşımaz", () => {
  const kt = readFileSync(new URL("../app/kargo-takip/page.tsx", import.meta.url), "utf8");
  assert.match(kt, /<GuestCancelRequest[^>]*isOwner=\{/);
  assert.match(kt, /const \{ id, paymentMethod, userId, \.\.\.order \} = found;\r?\n/);
  const so = readFileSync(new URL("../app/siparis-onay/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(so, /<GuestCancelRequest[^>]*isOwner=\{false\}/);
});
