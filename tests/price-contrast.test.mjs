import test from "node:test";
import assert from "node:assert/strict";

// Tailwind v4 / globals.css değerleri: oklch(L% C H) → sRGB → WCAG göreli parlaklık
function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((v) => Math.min(1, Math.max(0, v))); // doğrusal sRGB
}
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const ok = (L, C = 0, H = 0) => lum(oklchToRgb(L / 100, C, H));
const ratio = (fg, bg) => (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);

const red = {
  // [açık temada ham ölçek, .dark'ta ters çevrilmiş ölçek]
  900: { light: [39.6, 0.141, 25.723], dark: [93.6, 0.032, 17.717] },
  700: { light: [50.5, 0.213, 27.518], dark: [80.8, 0.114, 19.571] },
  600: { light: [57.7, 0.245, 27.325], dark: [70.4, 0.191, 22.216] },
  200: { raw: [88.5, 0.062, 18.334] },
  300: { raw: [80.8, 0.114, 19.571] },
  400: { raw: [70.4, 0.191, 22.216] },
};
const L = (arr) => ok(...arr);

// PRICE_TONE (components/PriceLadder.tsx): themed = 900/700/600/600, onDark = 200/300/400/400
const rows = [
  ["kupon", 900, 200], ["havale", 700, 300], ["mağaza", 600, 400], ["indirimli fiyat", 600, 400],
];

test("AÇIK tema: beyaz ve neutral-50 zeminde ≥ 4.5:1", () => {
  for (const bg of [ok(100), ok(98.5)]) for (const [name, k] of rows) {
    const r = ratio(L(red[k].light), bg);
    assert.ok(r >= 4.5, `${name} ${r.toFixed(2)}`);
  }
});
test("KOYU tema (ölçek ters): kart (#171717 civarı) ve sayfa zemininde ≥ 4.5:1", () => {
  for (const bg of [ok(20.5), ok(14.5)]) for (const [name, k] of rows) {
    const r = ratio(L(red[k].dark), bg);
    assert.ok(r >= 4.5, `${name} ${r.toFixed(2)}`);
  }
});
test("Açık temada koyu zeminli kart (zinc-900/zinc-800): ham 200/300/400 ≥ 4.5:1", () => {
  for (const bg of [ok(21, 0.006, 285.885), ok(27.4, 0.006, 286.033)]) for (const [name, , k] of rows) {
    const r = ratio(L(red[k].raw), bg);
    assert.ok(r >= 4.5, `${name} ${r.toFixed(2)}`);
  }
});
test("kupondan mağazaya doğru kırmızı canlanır (açık: koyudan canlıya, koyu: soluktan doyguna)", () => {
  const chroma = (k, m) => red[k][m][1];
  assert.ok(chroma(900, "light") < chroma(700, "light") && chroma(700, "light") < chroma(600, "light"));
  assert.ok(chroma(900, "dark") < chroma(700, "dark") && chroma(700, "dark") < chroma(600, "dark"));
});
test("mağaza satırı ve indirimli fiyat rozetle (bg-red-600) aynı ölçek rengi", () => {
  const src = (f) => import("node:fs").then((fs) => fs.readFileSync(new URL(f, import.meta.url), "utf8"));
  return Promise.all([src("../components/PriceLadder.tsx"), src("../components/ProductCard.tsx")]).then(([ladder, card]) => {
    assert.match(ladder, /pickup: "text-red-600", sale: "text-red-600"/);
    assert.match(card, /bg-red-600/);
  });
});
