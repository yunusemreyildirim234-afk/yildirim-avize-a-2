import test from "node:test";
import assert from "node:assert/strict";

test("fiyat merdiveni: havale satırı etiketi yüzdeli (hesap yalnızca ürün tutarından); mağaza satırı değişmez", async () => {
  const { readFileSync } = await import("node:fs");
  const l = readFileSync(new URL("../lib/price-ladder.ts", import.meta.url), "utf8");
  assert.match(l, /label: `\+ Havale\/EFT ile \(%\$\{t\}\)`, short: `Havale\/EFT %\$\{t\}`/);
  assert.ok(!/Havale\/EFT indirimi/.test(l));
  assert.match(l, /Mağazadan teslimle \(%\$\{t\}\)/);
});
