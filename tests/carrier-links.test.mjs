import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { carrierTrackingLink, carrierDisplayName } = await import("../lib/carrier-links.ts");

test("Aras id ile: Aras bağlantısı, kod URL-kodlanır", () => {
  const r = carrierTrackingLink({ providerId: 4, providerName: null, code: "A B/1" });
  assert.equal(r.href, "https://kargotakip.araskargo.com.tr/?kargotakipno=A%20B%2F1");
  assert.equal(r.label, "Aras Kargo ile Canlı Takip Et ↗");
});
test("Aras ad ile", () => {
  assert.match(carrierTrackingLink({ providerName: "Aras Kargo", code: "123" }).href, /araskargo/);
});
test("Hepsijet: ana sayfa, kod ayrıca döner", () => {
  const r = carrierTrackingLink({ providerId: 6, providerName: "Hepsijet", code: "HJ1" });
  assert.equal(r.href, "https://www.hepsijet.com/");
  assert.equal(r.label, "Hepsijet'te Takip Et ↗");
  assert.equal(r.code, "HJ1");
});
test("bilinmeyen/boş firma: bağlantı yok", () => {
  const r = carrierTrackingLink({ code: "X1" });
  assert.equal(r.href, null);
  assert.equal(r.code, "X1");
  assert.equal(carrierTrackingLink({ providerName: "Sürat", code: "1" }).href, null);
});
test("varsayılan firma adı Kargo", () => {
  assert.equal(carrierDisplayName(null), "Kargo");
  assert.equal(carrierDisplayName(" Hepsijet "), "Hepsijet");
});
