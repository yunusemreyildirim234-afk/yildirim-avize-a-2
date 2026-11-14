import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("alt bilgi: harita iframe'i açılışta yok, tıklayınca yüklenir; telif yılı dinamik; yol tarifi ve WhatsApp/telefon aynı", () => {
  const f = read("components/Footer.tsx");
  assert.doesNotMatch(f, /<iframe/);
  assert.match(f, /<FooterMap /);
  assert.match(f, /new Date\(\)\.getFullYear\(\)/);
  assert.doesNotMatch(f, /© 2026/);
  assert.match(f, /Yol Tarifi Al →/);
  assert.match(f, /href=\{`tel:\$\{PHONE_TEL\}`\}/);
  const m = read("components/FooterMap.tsx");
  assert.match(m, /Haritayı göster/);
  assert.match(m, /useState\(false\)/);
  assert.match(m, /if \(shown\)[\s\S]*<iframe/);
});
