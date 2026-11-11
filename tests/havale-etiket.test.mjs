import test from "node:test";
import assert from "node:assert/strict";

test("fiyat merdiveni: havale satırı etiketinde yüzde yok; mağaza satırı değişmez", async () => {
  const { readFileSync } = await import("node:fs");
  const l = readFileSync(new URL("../lib/price-ladder.ts", import.meta.url), "utf8");
  assert.match(l, /label: "\+ Havale\/EFT indirimi", short: "Havale\/EFT"/);
  assert.ok(!/Havale\/EFT ile/.test(l));
  assert.match(l, /Mağazadan teslimle \(%\$\{t\}\)/);
});
