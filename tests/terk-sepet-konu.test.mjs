import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

process.env.RESEND_API_KEY = "test-key";
process.env.NEXTAUTH_SECRET = "test-secret-yalnizca-test-icin-0123456789"; // List-Unsubscribe belirteci için sahte anahtar
const sent = [];
globalThis.fetch = async (_u, init) => (sent.push(JSON.parse(init.body)), { ok: true, json: async () => ({}) });
const { abandonedCartSubject, sendAbandonedCartEmail } = await import("../lib/email.ts");

test("konu: etiketle, en çok 60 karakter", () => {
  assert.equal(abandonedCartSubject("%10"), "Sepetiniz sizi bekliyor — %10 indirim kodu");
  assert.equal(abandonedCartSubject("250 TL"), "Sepetiniz sizi bekliyor — 250 TL indirim kodu");
  for (const l of ["%5", "%15", "1.250,50 TL", "x".repeat(80)]) assert.ok(abandonedCartSubject(l).length <= 60, l);
});

test("gönderilen e-posta: kısa konu, kupon kodu gövdede, kampanya alt bilgisi ve List-Unsubscribe korunur", async () => {
  await sendAbandonedCartEmail({
    to: "musteri@example.com",
    name: "Test",
    orderId: "abcdef12-0000-0000-0000-000000000000",
    items: [{ title: "Avize", quantity: 1 }],
    couponCode: "YILDIRIM5",
    discountLabel: "%5",
    footerHtml: "<p id=\"kampanya-alt-bilgi\">Aboneliği iptal et</p>",
  });
  const m = sent.at(-1);
  assert.ok(m.subject.length <= 60);
  assert.equal(m.subject, "Sepetiniz sizi bekliyor — %5 indirim kodu");
  assert.doesNotMatch(m.subject, /YILDIRIM5/);
  assert.match(m.html, /YILDIRIM5/);
  assert.match(m.html, /kampanya-alt-bilgi/);
  assert.ok(m.headers && Object.keys(m.headers).some((k) => k.toLowerCase() === "list-unsubscribe"));
});
