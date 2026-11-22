import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const FALLBACK = /shippingTrackingCode\s*\|\|\s*(?:order\.)?shippingBarcode/;

test("kargo-takip: takip kodu yoksa barkod CopyTrackingCode ile gösterilir", () => {
  const src = read("app/kargo-takip/page.tsx");
  assert.match(src, FALLBACK);
  assert.match(src, /<CopyTrackingCode code=\{trackingCode\}/);
  assert.doesNotMatch(src, /Barkod: <span className="font-mono">/);
});

test("giris: Siparişlerim takip no, bağlantı ve kopyalama barkoda düşer", () => {
  const src = read("app/giris/page.tsx");
  assert.match(src, /<CopyTrackingCode code=\{order\.shippingTrackingCode\s*\|\|\s*order\.shippingBarcode/);
  assert.match(src, /encodeURIComponent\(order\.shippingTrackingCode\s*\|\|\s*order\.shippingBarcode/);
  assert.match(src, /carrierTrackingLink\(\{[^}]*code: order\.shippingTrackingCode\s*\|\|\s*order\.shippingBarcode/);
});
