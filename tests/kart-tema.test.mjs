import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// Kartlar sayfa temasını izler: bölüm adına bağlı "zıt tema" (dark prop'u) yok.
const root = new URL("../", import.meta.url);
const src = (f) => readFileSync(new URL(f, root), "utf8");
const files = ["app", "components"].flatMap((dir) =>
  readdirSync(new URL(`${dir}/`, root), { recursive: true })
    .map((f) => `${dir}/${String(f).replaceAll("\\", "/")}`)
    .filter((f) => f.endsWith(".tsx")),
);

/** Verilen bileşenlere `dark` prop'u geçen JSX çağrıları: "dosya <Bileşen> dark..." */
function darkCalls(names) {
  const tag = new RegExp(`<(${names})\\b((?:[^<>{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*?)\\/?>`, "g");
  return files.flatMap((f) =>
    [...src(f).matchAll(tag)].flatMap(([, name, props]) => {
      const dark = props.match(/(?<=\s)dark(?:=\{(?:[^{}]|\{[^{}]*\})*\}|(?=[\s/]|$))/);
      return dark ? [`${f} <${name}> ${dark[0]}`] : [];
    }),
  );
}

test("tarama ProductCard çağrılarını görüyor", () => {
  const callers = files.filter((f) => /<ProductCard\b/.test(src(f))).sort();
  assert.deepEqual(callers, [
    "app/cart-more.tsx",
    "app/home-more.tsx",
    "app/page.tsx",
    "app/similar-more.tsx",
    "app/urun/[id]/page.tsx",
    "components/ProductListing.tsx",
  ]);
});

test("Çok Satanlar 'Daha fazla göster' kartı bölüm adına göre dark almaz", () => {
  assert.doesNotMatch(src("app/home-more.tsx"), /dark=\{\s*key\s*===\s*"bestsellers"\s*\}/);
  assert.match(src("app/home-more.tsx"), /<ProductCard key=\{p\.id\} product=\{p\} \/>/);
});

test("ProductCard / MoreProducts / MoreCards çağrılarının hiçbiri dark vermez", () => {
  assert.deepEqual(darkCalls("ProductCard|MoreProducts|MoreCards"), []);
});

test("korunan tek dark aktarımı: ProductCard içindeki PriceLadder", () => {
  assert.deepEqual(darkCalls("PriceLadder"), ["components/ProductCard.tsx <PriceLadder> dark={dark}"]);
  // aktarılan değer prop'un varsayılanından gelir (false) → kart temayı izler
  assert.match(src("components/ProductCard.tsx"), /\r?\n\s*dark = false,\r?\n/);
});
