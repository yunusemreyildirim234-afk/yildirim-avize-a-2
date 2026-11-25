import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ürün kartı ve PriceLadder küçük metinleri WCAG AA (4,5:1). Renk değerleri globals.css + tailwindcss/theme.css'ten OKUNUR.
const read = (f) => readFileSync(new URL(f, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const css = read("../app/globals.css");
const ladder = read("../components/PriceLadder.tsx");
const card = read("../components/ProductCard.tsx");

const block = (sel) => { const a = css.indexOf(`\n${sel} {`); assert.ok(a >= 0, sel); return css.slice(a, css.indexOf("\n}", a)); };
const vars = (s) => Object.fromEntries([...s.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const light = { ...vars(read("../node_modules/tailwindcss/theme.css")), "--color-white": "#ffffff", ...vars(block(":root")) };
const themes = { açık: light, koyu: { ...light, ...vars(block(".dark")) } };

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function rgb(v) {
  if (v.startsWith("#")) {
    const h = v.length === 4 ? "#" + [...v.slice(1)].map((x) => x + x).join("") : v;
    return [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
  }
  const [L, C, H] = v.match(/oklch\(([^)]+)\)/)[1].split(/\s+/).map((x, i) => (x === "none" ? 0 : parseFloat(x) / (i === 0 ? 100 : 1)));
  const h = (H * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((x) => Math.min(1, Math.max(0, x)));
}
const lum = (v) => { const [r, g, b] = rgb(v); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const color = (theme, name) => { const v = theme[`--ya-${name}`] ?? theme[`--color-${name}`]; assert.ok(v, `renk yok: ${name}`); return v; };
const ratio = (theme, fg, bg) => { const a = lum(color(theme, fg)), b = lum(color(theme, bg)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
const check = (themeName, fg, bg) => { const r = ratio(themes[themeName], fg, bg); assert.ok(r >= 4.5, `${themeName}: ${fg} / ${bg} = ${r.toFixed(2)}`); };

// Sınıf dizisinden temada geçerli renk adı: "text-red-800 dark:text-red-700" → açık red-800, koyu red-700
const toneOf = (classes, themeName) => {
  const list = classes.split(" ");
  const pick = (themeName === "koyu" && list.find((c) => c.startsWith("dark:text-"))) || list.find((c) => c.startsWith("text-"));
  return pick.replace(/^(dark:)?text-/, "");
};
// PriceLadder'ın kullanıldığı zeminler: kart (surface); sepet, ürün sayfası, favoriler, arama (raised); sayfa zemini (canvas)
const SURFACES = ["canvas", "surface", "raised"];

test("PriceLadder kırmızıları (kupon/havale/mağaza/indirimli) her zeminde iki temada ≥ 4,5:1", () => {
  const themed = ladder.match(/themed: \{([^}]+)\}/)[1];
  const tones = Object.fromEntries([...themed.matchAll(/(\w+): "([^"]+)"/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(Object.keys(tones), ["coupon", "bank", "pickup", "sale"]);
  for (const t of Object.keys(themes)) {
    for (const classes of Object.values(tones)) for (const bg of SURFACES) check(t, toneOf(classes, t), bg);
    // havale / mağaza / kupon ayrımı korunur: üçü farklı ton
    assert.equal(new Set(["coupon", "bank", "pickup"].map((k) => toneOf(tones[k], t))).size, 3, t);
  }
});

test("gri açıklama ve kargo notu: normal zeminde ink-subtle, koyu zeminli kartta zinc-400; iki temada ≥ 4,5:1", () => {
  const pairs = [...ladder.matchAll(/dark \? "text-([a-z0-9-]+)" : "text-([a-z0-9-]+)"/g)];
  assert.equal(pairs.length, 2); // açıklama + "Fiyatlar kargo hariçtir"
  for (const [, onDark, themed] of pairs) {
    assert.equal(themed, "ink-subtle");
    assert.equal(onDark, "zinc-400");
    for (const t of Object.keys(themes)) {
      for (const bg of SURFACES) check(t, themed, bg);
      check(t, onDark, "zinc-900");
    }
  }
  assert.doesNotMatch(ladder, /text-(neutral|zinc)-500/);
});

test("kart küçük metinleri (surface zemin) ve indirim rozeti iki temada ≥ 4,5:1", () => {
  for (const cls of ["text-bronze-ink", "text-ink-muted", "text-ink-subtle"]) assert.ok(card.includes(cls), cls);
  assert.match(card, /bg-sale text-white/);
  for (const t of Object.keys(themes)) {
    for (const fg of ["ink", "ink-muted", "ink-subtle", "bronze-ink", "sale"]) check(t, fg, "surface");
    check(t, "white", "sale");
  }
  assert.doesNotMatch(card, /text-(neutral|gray)-[45]00/);
});
