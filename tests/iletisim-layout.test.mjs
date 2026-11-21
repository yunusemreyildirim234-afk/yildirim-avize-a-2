import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("iletisim/layout.tsx: kurumsal blok yok (yalnız footer'da)", () => {
  const s = readFileSync(new URL("../app/iletisim/layout.tsx", import.meta.url), "utf8");
  assert.ok(!/CompanyInfo/.test(s));
  assert.ok(!/bg-neutral-50|bg-surface/.test(s));
});

test("iletisim/page.tsx: marka logosu priority ile, dekoratif alt", () => {
  const s = readFileSync(new URL("../app/iletisim/page.tsx", import.meta.url), "utf8");
  assert.match(s, /logo-hero-4\.png/);
  assert.match(s, /priority/);
});

test("iletisim/page.tsx: logo-uc-gen.png kullanılıyor", () => {
  const s = readFileSync(new URL("../app/iletisim/page.tsx", import.meta.url), "utf8");
  assert.match(s, /logo-uc-gen\.png/);
});
