import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const page = read("app/page.tsx");
const row = read("components/CollectionsRow.tsx");
// Ana sayfadaki koleksiyon satırının tamamı (açılıştan kapanışa)
const block = page.match(/<CollectionsRow[\s\S]*?<\/CollectionsRow>/)?.[0] ?? "";

test("bağlantı (a/Link) üzerinde listitem rolü yok", () => {
  assert.ok(block, "CollectionsRow bloğu bulunamadı");
  assert.doesNotMatch(block, /role=["']listitem["']/);
  assert.doesNotMatch(page, /<(?:a|Link)\b[^>]*\brole=["']listitem["']/);
});

test("her kart bir <li> içinde ve data-testid bağlantının üzerinde", () => {
  assert.match(block, /<li key=\{c\.slug\}[^>]*>\r?\n\s*<Link\b[^>]*data-testid="koleksiyon-kart"[^>]*>[\s\S]*?<\/Link>\r?\n\s*<\/li>/);
  assert.equal(block.match(/data-testid="koleksiyon-kart"/g)?.length, 1);
  assert.match(block, /<Link\b[^>]*href=\{`\/kategori\/\$\{c\.slug\}`\}/);
});

test("kapsayıcı <ul role=\"list\"> ve işaretleyicisi sıfır; kaydırma sınıfları duruyor", () => {
  const m = row.match(/<ul ref=\{ref\} role="list" className="([^"]*)">\r?\n\s*\{children\}\r?\n\s*<\/ul>/);
  assert.ok(m, "<ul role=\"list\"> kapsayıcı bulunamadı");
  // Sınıflar tek tek: birleşik yazılan (boşluğu düşen) sınıf sessizce kaybolur
  assert.deepEqual(m[1].split(" "), [
    "list-none", "flex", "gap-4", "overflow-x-auto", "snap-x", "snap-mandatory", "scroll-smooth", "pb-2",
    "[scrollbar-width:none]", "[&::-webkit-scrollbar]:hidden",
  ]);
});

test("kart genişliği ve snap, kaydırılan satırın doğrudan öğesi olan <li> üzerinde", () => {
  assert.match(block, /<li [^>]*className="flex shrink-0 snap-start w-\[calc\(50%-8px\)\] lg:w-\[calc\(25%-12px\)\]"/);
  assert.match(block, /<Link\b[^>]*className="group flex w-full min-w-0 flex-col /);
});
