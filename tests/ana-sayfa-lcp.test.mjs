import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("ana sayfa LCP görseli (hero): preload + fetchPriority=high, lazy değil, sizes=100vw", () => {
  const images = read("components/Hero.tsx").match(/<Image\r?\n[\s\S]*?\/>/g) ?? [];
  assert.equal(images.length, 1);
  const img = images[0];
  assert.match(img, /src="\/hero\/salon-avize\.webp"/);
  assert.match(img, /\r?\n\s+preload\r?\n/);
  assert.match(img, /\r?\n\s+fetchPriority="high"\r?\n/);
  assert.match(img, /\r?\n\s+sizes="100vw"\r?\n/);
  assert.doesNotMatch(img, /loading=|priority(?!=)\b/);
});

test("ana sayfa: ilk ekranın altındaki görseller LCP görseliyle yarışmaz (priority/preload/eager yok)", () => {
  const page = read("app/page.tsx");
  assert.match(page, /<Hero \/>/);
  assert.doesNotMatch(page, /\bpriority\b|\bpreload\b|fetchPriority|loading="eager"/);
});

test("ürün kartı görseli yalnızca priority istenirse öncelikli; varsayılan lazy", () => {
  assert.match(read("components/ProductCard.tsx"), /priority = false,/);
  assert.match(read("components/CardImages.tsx"), /priority = false,/);
});

test("içeriğe atla: hedef sunucu çıktısında var ve odaklanılabilir; bağlantı odaklanınca görünür", () => {
  const layout = read("app/layout.tsx");
  assert.match(layout, /<div id="icerik" tabIndex=\{-1\}>\r?\n\s+\{children\}\r?\n\s+<\/div>/);
  assert.ok(layout.indexOf("<SkipLink />") < layout.indexOf("<Navbar"));
  const link = read("components/SkipLink.tsx");
  assert.match(link, /const TARGET_ID = "icerik";/);
  assert.match(link, /href=\{`#\$\{TARGET_ID\}`\}/);
  assert.match(link, /document\.getElementById\(TARGET_ID\)/);
  assert.match(link, /sr-only focus:not-sr-only focus:fixed/);
  assert.match(read("app/globals.css"), /#icerik \{\r?\n\s+outline: none;/);
});
