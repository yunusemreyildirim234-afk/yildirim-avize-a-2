import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Kargonomi durum kartı: açılışta istek yok (tick 0), düğmeyle çalışır", () => {
  const s = readFileSync(new URL("../components/AdminKargonomiHeader.tsx", import.meta.url), "utf8");
  assert.match(s, /if \(tick === 0\) return;/);
  assert.match(s, /"Kontrol et"/);
  assert.match(s, /setTick\(\(t\) => t \+ 1\)/);
});
