import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const zoom = readFileSync(new URL("../components/ImageZoom.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../components/ProductDetailClient.tsx", import.meta.url), "utf8");

test("ürün ana görseli ve büyüteç kesmez: object-contain, beyaz zemin", () => {
  const main = zoom.slice(zoom.indexOf("export function HoverMagnifier"), zoom.indexOf("const MIN"));
  assert.ok(!main.includes("object-cover"));
  assert.equal((main.match(/object-contain/g) ?? []).length, 2);
  assert.match(main, /shadow-xl bg-white/);
  assert.match(detail, /flex-1 overflow-hidden flex items-center justify-center bg-white/);
});
