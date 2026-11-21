import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { carrierTrackingLink, carrierDisplayName } = await import("../lib/carrier-links.ts");

test("Aras id ile: Aras bağlantısı, kod URL-kodlanır", () => {
  const r = carrierTrackingLink({ providerId: 4, providerName: null, code: "A B/1" });
  assert.equal(r.href, "https://www.araskargo.com.tr/");
  assert.ok(!r.href.includes("A%20B"), "href kodu içermez");
  assert.equal(r.code, "A B/1");
  assert.equal(r.label, "Aras Kargo'da sorgula ↗");
  assert.equal(r.queryLabel, "Aras Kargo'da sorgula ↗");
  assert.equal(r.hint, "Takip numaranızı açılan sayfaya yapıştırın");
});
test("Aras: kod boşsa href null", () => {
  assert.equal(carrierTrackingLink({ providerId: 4, code: "  " }).href, null);
});
test("kodda kargotakip.araskargo geçen yer kalmadı", async () => {
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const needle = "kargotakip.araskargo";
  const hits = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      if ([".git", ".next", "node_modules", "e2e", "tests", "docs"].includes(n)) continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|mjs|js|json)$/.test(n) && readFileSync(p, "utf8").includes(needle)) hits.push(p);
    }
  };
  walk(fileURLToPath(new URL("..", import.meta.url)));
  assert.deepEqual(hits, []);
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
