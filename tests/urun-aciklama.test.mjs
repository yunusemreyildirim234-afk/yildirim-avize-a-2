import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DESCRIPTION_OVERWRITE_WARNING, MAX_DESCRIPTION, isTextOverwrite, normalizeDescription, snapshotDescription } from "../lib/product-description.ts";
import { DEFAULT_SYNC_MODES } from "../lib/trendyol-modes.ts";
import { decide } from "../lib/trendyol-plan.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("açıklama temizliği: satır sonu, denetim karakteri, kırpma; boş metin null", () => {
  assert.deepEqual(normalizeDescription("  Kristal avize.\r\nE14 duy.\u0000​  "), { ok: true, value: "Kristal avize.\nE14 duy." });
  assert.deepEqual(normalizeDescription("a\tb\n\nc"), { ok: true, value: "a\tb\n\nc" }, "sekme ve boş satır korunur");
  assert.deepEqual(normalizeDescription("   \n "), { ok: true, value: null });
  assert.deepEqual(normalizeDescription(null), { ok: true, value: null });
  assert.deepEqual(normalizeDescription("<b>kalın</b>"), { ok: true, value: "<b>kalın</b>" }, "HTML ayıklanmaz: vitrin düz metin basar");
});

test("açıklama: metin olmayan girdi ve sınırı aşan metin reddedilir (sessizce kesilmez)", () => {
  for (const bad of [undefined, 5, {}, ["a"], true]) assert.equal(normalizeDescription(bad).ok, false);
  assert.equal(normalizeDescription("a".repeat(MAX_DESCRIPTION)).ok, true);
  const over = normalizeDescription("a".repeat(MAX_DESCRIPTION + 1));
  assert.equal(over.ok, false);
  assert.match(over.error, /en fazla 10\.000 karakter/);
});

test("Trendyol metni anlık görüntüden okunur; kayıt yoksa null", () => {
  assert.equal(snapshotDescription({ title: "x", description: "Trendyol metni" }), "Trendyol metni");
  for (const none of [null, undefined, "metin", [], {}, { description: null }, { description: "  " }, { description: 5 }]) assert.equal(snapshotDescription(none), null);
});

test("eşitleme uyarısı yalnızca TEXT 'Ezerek' iken; elle yazılan açıklama 'Koruyarak'ta korunur, 'Ezerek'te ezilir", () => {
  assert.equal(isTextOverwrite(DEFAULT_SYNC_MODES), false);
  assert.equal(isTextOverwrite({ ...DEFAULT_SYNC_MODES, TEXT: "KEEP" }), false);
  assert.equal(isTextOverwrite({ ...DEFAULT_SYNC_MODES, TEXT: "OVERWRITE" }), true);
  assert.equal(isTextOverwrite(null), false);
  assert.equal(DESCRIPTION_OVERWRITE_WARNING, "Bu modda yazdığınız açıklama Trendyol eşitlemesinde üzerine yazılır.");
  // Gerçek eşitleme kararı: şimdiki = elle yazılan, Trendyol ve anlık görüntü = eski Trendyol metni
  assert.equal(decide("SKIP", "benim metnim", "trendyol", "trendyol", true).karar, "ATLANDI");
  assert.equal(decide("KEEP", "benim metnim", "trendyol", "trendyol", true).karar, "KORUNACAK");
  assert.equal(decide("OVERWRITE", "benim metnim", "trendyol", "trendyol", true).karar, "EZİLECEK");
});

test("uç: GET ve açıklama PATCH yönetici oturumu ister, temizleme çekirdeğini kullanır, yalnızca açıklamayı yazar", () => {
  const route = read("../app/api/admin/product/route.ts");
  const get = route.slice(route.indexOf("export async function GET"), route.indexOf("// 1. Yeni Avize Ekleme"));
  assert.match(get, /const denied = await adminGuard\(\);\s*if \(denied\) return denied;/);
  assert.match(get, /PRODUCT_ID_RE\.test\(productId\)/);
  assert.match(get, /trendyolDescription: snapshotDescription\(product\.syncSnapshot\)/);
  assert.match(get, /textOverwrite: isTextOverwrite\(resolveSyncModes\(config\?\.homepageConfig\)\.modes\)/);
  assert.ok(!/\.update|\.create|\.delete|\.upsert/.test(get), "GET salt okunur");
  const patch = route.slice(route.indexOf("async function PATCHHandler"), route.indexOf("// 3. Avizeyi Güvenle Silme"));
  assert.ok(patch.indexOf("await adminGuard()") < patch.indexOf('"description" in body'), "oturum kontrolü önce");
  assert.match(patch, /const description = normalizeDescription\(body\.description\);\s*if \(!description\.ok\) return NextResponse\.json\(\{ error: description\.error \}, \{ status: 400 \}\);/);
  assert.match(patch, /updateMany\(\{ where: \{ id: body\.productId \}, data: \{ description: description\.value \} \}\)/);
  assert.match(route, /export const PATCH = withStorefrontRevalidate\(PATCHHandler\);/, "kayıt sonrası vitrin yenilenir");
});

test("arayüz: 'Açıklamayı düzenle', 'Kopyala', Trendyol metnini göster / geri yükle ve belirgin uyarı", () => {
  const list = read("../components/AdminProductList.tsx");
  assert.match(list, /"Açıklamayı düzenle"/);
  assert.match(list, /descId === product\.id && <AdminDescriptionEditor/);
  const ed = read("../components/AdminDescriptionEditor.tsx");
  for (const text of ["Kopyala", "Trendyol metnini göster", "Trendyol metnini geri yükle", "navigator.clipboard.writeText(value)"]) assert.ok(ed.includes(text), text);
  assert.match(ed, /loaded\?\.textOverwrite && \(\s*<p role="alert"/);
  assert.match(ed, /\{DESCRIPTION_OVERWRITE_WARNING\}/);
  assert.ok(!/dangerouslySetInnerHTML/.test(ed), "Trendyol metni düz yazı olarak basılır");
});
