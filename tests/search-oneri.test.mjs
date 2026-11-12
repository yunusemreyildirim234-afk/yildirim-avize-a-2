import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("searchSuggestion: yalnızca önbellekli katalogdan (catalogRows), veritabanına ek sorgu yok; öneri kendisi eşleşmeli", () => {
  const src = read("lib/listing.ts");
  const fn = src.slice(src.indexOf("export async function searchSuggestion"), src.indexOf("/** Üst arama kutusu"));
  assert.match(fn, /await catalogRows\(\)/);
  assert.ok(!/prisma|\$queryRaw|findMany/.test(fn));
  assert.match(fn, /rows\.some\(\(r\) => matchesSearchTolerant\(r, s\)\)/);
});

test("/api/search: öneri yalnızca sonuç boşken hesaplanır; hız sınırı ve serverError aynen", () => {
  const src = read("app/api/search/route.ts");
  assert.match(src, /if \(ids\.length === 0\) return NextResponse\.json\(\{ products: \[\], suggestion: await searchSuggestion\(q\) \}\);/);
  assert.equal((src.match(/searchSuggestion\(/g) ?? []).length, 1);
  assert.match(src, /rateLimit\(req, "search", 120, 60_000\)/);
});

test("/arama: öneri yalnızca gerçek 0 sonuçta ve limit/hata değilken; bağlantı /arama?q=", () => {
  const src = read("app/arama/page.tsx");
  assert.match(src, /if \(q && listing && total === 0 && !limited && !failed\) suggestion = await searchSuggestion\(q\)/);
  assert.match(src, /Bunu mu demek istediniz/);
  assert.match(src, /href=\{`\/arama\?q=\$\{encodeURIComponent\(suggestion\)\}`\}/);
});

test("NavSearch: boş sonuçta öneri düğmesi sorguyu değiştirir; temizleme önerisini sıfırlar", () => {
  const src = read("components/NavSearch.tsx");
  assert.match(src, /Bunu mu demek istediniz/);
  assert.match(src, /onSuggest=\{onChange\}/);
  assert.ok((src.match(/setSuggestion\(null\)/g) ?? []).length >= 2);
});

test("/arama sekme başlığı sorguyu içerir; dizine alınmama ve canonical kuralı korunur", () => {
  const src = read("app/arama/page.tsx");
  assert.match(src, /export async function generateMetadata\(\{ searchParams \}: Props\): Promise<Metadata>/);
  assert.match(src, /title: q \? `"\$\{q\}" araması` : "Arama Sonuçları"/);
  assert.match(src, /alternates: \{ canonical: null \}/);
  assert.match(src, /robots: \{ index: false, follow: true \}/);
});

test("Son aramalar paneli: klavyeyle dışarı odaklanınca kapanır; relatedTarget yoksa (tıklama) kapanmaz; Escape ve dışarı tıklama korunur", () => {
  const src = read("components/NavSearch.tsx");
  assert.match(src, /onBlur=\{\(e\) => \{[\s\S]*?next && !e\.currentTarget\.contains\(next\)\) setOpen\(false\);/);
  assert.match(src, /e\.key === "Escape" && setOpen\(false\)/);
  assert.match(src, /addEventListener\("mousedown", onDown\)/);
});
