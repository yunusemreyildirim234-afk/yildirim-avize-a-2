import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
const css = src("../app/globals.css");
const ladder = src("../components/PriceLadder.tsx");
const card = src("../components/ProductCard.tsx");

// --- WCAG göreli parlaklık ---
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexLum = (hex) => {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(n.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// Tailwind v4 oklch(L% C H) → doğrusal sRGB → parlaklık (onDark ham ölçekleri için)
function oklchLum(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = (L / 100 + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L / 100 - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L / 100 - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const [r, g, bl] = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}
const ratio = (fg, bg) => (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);

// --- Jetonlar globals.css'ten okunur (açık: ilk :root bloğu, koyu: .dark bloğu) ---
function tokens(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} bloğu yok`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--ya-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}
const light = tokens(":root");
const dark = tokens(".dark");

// --- PRICE_TONE sınıfları kaynaktan okunur: "text-<jeton>" → jeton adı ---
function toneMap(name) {
  const m = ladder.match(new RegExp(`${name}: \\{([^}]*)\\}`));
  assert.ok(m, `PRICE_TONE.${name} yok`);
  return Object.fromEntries([...m[1].matchAll(/(\w+): "text-([a-z-]+)"/g)].map((x) => [x[1], x[2]]));
}
const labelTone = toneMap("themed");
const amountTone = toneMap("themedAmount");
const KEYS = ["coupon", "bank", "pickup", "sale"];

test("PRICE_TONE.themed ve themedAmount yalnız --ya-* jetonu kullanır", () => {
  for (const k of KEYS) {
    assert.ok(light[labelTone[k]], `etiket ${k}: ${labelTone[k]} jeton değil`);
    assert.ok(light[amountTone[k]], `tutar ${k}: ${amountTone[k]} jeton değil`);
  }
});

test("AÇIK tema: etiket ve tutar canvas/surface/raised zeminde ≥ 4.5:1", () => {
  for (const bg of ["canvas", "surface", "raised"]) for (const k of KEYS) for (const t of [labelTone[k], amountTone[k]]) {
    const r = ratio(hexLum(light[t]), hexLum(light[bg]));
    assert.ok(r >= 4.5, `${k} ${t} / ${bg}: ${r.toFixed(2)}`);
  }
});

test("KOYU tema: etiket ve tutar canvas/surface/raised zeminde ≥ 4.5:1", () => {
  for (const bg of ["canvas", "surface", "raised"]) for (const k of KEYS) for (const t of [labelTone[k], amountTone[k]]) {
    const r = ratio(hexLum(dark[t]), hexLum(dark[bg]));
    assert.ok(r >= 4.5, `${k} ${t} / ${bg}: ${r.toFixed(2)}`);
  }
});

test("Açık temada koyu zeminli kart (zinc-900/zinc-800): onDark ham red-200/300/400 ≥ 4.5:1", () => {
  assert.match(ladder, /onDark: \{ coupon: "text-red-200", bank: "text-red-300", pickup: "text-red-400", sale: "text-red-400" \}/);
  const red = { 200: [88.5, 0.062, 18.334], 300: [80.8, 0.114, 19.571], 400: [70.4, 0.191, 22.216] };
  for (const bg of [oklchLum(21, 0.006, 285.885), oklchLum(27.4, 0.006, 286.033)]) for (const k of [200, 300, 400]) {
    const r = ratio(oklchLum(...red[k]), bg);
    assert.ok(r >= 4.5, `red-${k} ${r.toFixed(2)}`);
  }
});

test("indirimli fiyat ve kart indirim rozeti aynı jeton (sale); rozet yazısı ≥ 4.5:1", () => {
  assert.equal(labelTone.sale, "sale");
  assert.equal(amountTone.sale, "sale");
  assert.match(card, /bg-sale text-white/);
  // açık: beyaz yazı; koyu: .dark'ta --color-white koyu ölçeğe döner (oklch 20.5%)
  assert.ok(ratio(1, hexLum(light.sale)) >= 4.5, "açık rozet");
  assert.ok(ratio(oklchLum(20.5, 0, 0), hexLum(dark.sale)) >= 4.5, "koyu rozet");
});
