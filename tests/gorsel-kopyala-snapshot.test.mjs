import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("A3: kopyalama syncSnapshot'ı bayat kopyayla ezmez; yalnızca imageMap anahtarı aynı işlemde birleştirilir", () => {
  const s = src("lib/image-copy-store.ts");
  assert.ok(!/oldSnapshot/.test(s), "okunan eski snapshot geri yazılmaz");
  const upd = s.slice(s.indexOf("tx.product.updateMany"), s.indexOf("tx.$executeRaw"));
  assert.ok(!/syncSnapshot/.test(upd), "updateMany snapshot'a dokunmaz");
  assert.match(s, /\$executeRaw`UPDATE "Product" SET "syncSnapshot" =/);
  assert.match(s, /\|\| jsonb_build_object\('imageMap'/);
  assert.match(s, /WHERE "id" = \$\{plan\.id\}/);
  // ürün koşullu yazımı (0 satır → false) birleştirmeden önce
  assert.ok(s.indexOf("r.count !== 1") < s.indexOf("$executeRaw"));
  assert.match(s, /prisma\.\$transaction/);
});

test("A3: görsel kopyalama sürerken Trendyol eşitleme düğmeleri (Önizle, Seçilenleri uygula) kilitli", () => {
  const sync = src("components/AdminTrendyolSync.tsx");
  const copy = src("components/AdminImageCopy.tsx");
  assert.match(sync, /onRunningChange=\{setCopying\}/);
  assert.match(sync, /onClick=\{onPreview\} disabled=\{busy !== "" \|\| copying\}/);
  assert.match(sync, /onClick=\{onApply\} disabled=\{busy !== "" \|\| copying/);
  assert.match(copy, /onRunningChange\?\.\(true\)/);
  assert.match(copy, /finally \{\s*setRunning\(false\);\s*onRunningChange\?\.\(false\)/);
});
