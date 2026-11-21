import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../components/CopyTrackingCode.tsx", import.meta.url), "utf8");

test("CopyTrackingCode: client bileşen, clipboard ve aria-live kullanır", () => {
  assert.match(src, /^"use client"/);
  assert.match(src, /navigator\.clipboard\.writeText/);
  assert.match(src, /aria-live="polite"/);
  assert.match(src, /select-all/);
  assert.match(src, /min-h-11/);
});

test("CopyTrackingCode: müşteri ve admin sayfalarında kullanılır", () => {
  for (const f of ["../app/kargo-takip/page.tsx", "../app/giris/page.tsx", "../components/AdminKargonomiOrderActions.tsx"]) {
    assert.match(readFileSync(new URL(f, import.meta.url), "utf8"), /CopyTrackingCode/, f);
  }
});

test("carrier-links: Hepsijet ve Aras ipucu ve sorgula etiketi", async () => {
  await import("./_alias.mjs");
  const { carrierTrackingLink } = await import("../lib/carrier-links.ts");
  const h = carrierTrackingLink({ providerId: 6, code: "HJ1" });
  assert.match(h.queryLabel, /Hepsijet'te sorgula/);
  assert.equal(h.hint, "Gönderi numaranızı açılan sayfaya yapıştırın");
  assert.equal(carrierTrackingLink({ providerId: 4, code: "1" }).hint, "Takip numaranızı açılan sayfaya yapıştırın");
  assert.equal(carrierTrackingLink({ code: "1" }).href, null);
});
