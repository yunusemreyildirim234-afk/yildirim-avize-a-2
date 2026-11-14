import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("admin ürün sorgusu açıklamayı çekmez", () => {
  const page = src("app/admin/page.tsx");
  const q = page.slice(page.indexOf("prisma.product.findMany({"), page.indexOf("prisma.contactMessage.findMany"));
  // Dar select (lib/admin-product-list.ts): açıklama, eşitleme alanları ve görsel dizileri seçilmez
  assert.match(q, /select: ADMIN_LIST_PRODUCT_SELECT/);
  const sel = src("lib/admin-product-list.ts");
  assert.ok(!/\b(description|syncSnapshot|lastSyncedAt)\b\s*:/.test(sel.slice(sel.indexOf("ADMIN_LIST_VARIATION_SELECT"), sel.indexOf("export function coverByRule"))));
  assert.ok(!/\.description/.test(page), "sayfa açıklamayı hiçbir yerde kullanmaz");
});

test("liste, düzenleyici ve toplu çubuk açıklamayı okumaz ve sunucuya göndermez", () => {
  for (const f of ["AdminProductList", "AdminProductEditor", "AdminBulkBar", "AdminAddProduct"]) {
    const s = src(`components/${f}.tsx`);
    // AdminAddProduct yeni ürün oluştururken açıklama gönderir (POST); mevcut ürünü DÜZENLEYEN istekler göndermez
    if (f === "AdminAddProduct") continue;
    assert.ok(!/\bdescription\b/.test(s.replace(/description=\{/g, "").replace(/AdminDescriptionEditor/g, "")), `${f} açıklama alanına dokunmaz`);
  }
});

test("açıklama yalnızca kendi düzenleyicisinden, tek ürün için okunur ve yalnızca kendi alanı yazılır", () => {
  const ed = src("components/AdminDescriptionEditor.tsx");
  assert.match(ed, /JSON\.stringify\(\{ productId, description: value \}\)/);
  const route = src("app/api/admin/product/route.ts");
  const get = route.slice(route.indexOf("export async function GET"), route.indexOf("// 1. Yeni Avize Ekleme"));
  assert.match(get, /findUnique\(/);
});

test("açıklamaya dokunmayan düzenleme açıklamayı silemez: genel düzenleme dalı yalnızca gelen alanları yazar", () => {
  const route = src("app/api/admin/product/route.ts");
  const patch = route.slice(route.indexOf("async function PATCHHandler"), route.indexOf("// 3. Avizeyi Güvenle Silme"));
  const descBranch = patch.slice(patch.indexOf("// Açıklama düzenleme (M15)"), patch.indexOf("// Tekil ürün düzenleme"));
  const rest = patch.replace(descBranch, "");
  // Açıklama dalı dışında hiçbir yazma "description" anahtarı taşımaz
  assert.ok(!/description/.test(rest), "diğer PATCH dallarında açıklama yazılmaz");
  // Genel düzenleme: data nesnesi yalnızca istekte bulunan alanlardan kurulur (tipinde açıklama yoktur)
  const edit = patch.slice(patch.indexOf("// Tekil ürün düzenleme"), patch.indexOf("// Eski kısa yol"));
  assert.match(edit, /const data: \{ title\?: string; basePrice\?: number; images\?: string\[\]; imageUrl\?: string \| null; modelCode\?: string \| null; isFeatured\?: boolean; isBestSeller\?: boolean; ebat\?: string \| null \} = \{\};/);
  assert.match(edit, /tx\.product\.update\(\{ where: \{ id: body\.productId \}, data \}\)/);
});

test("geri alma açıklamayı ezmez: alan anlık görüntüsünde açıklama yoktur (yalnızca silinen ürünün sunucudaki tam kopyasında)", () => {
  const undo = src("lib/admin-undo.ts");
  const keys = undo.slice(undo.indexOf("const FIELD_KEYS = ["), undo.indexOf("] as const;"));
  assert.ok(!/description/.test(keys));
  // Silme geri alma kopyası istemciden değil veritabanından alınır
  assert.match(undo, /export async function snapshotForDelete\(productId: string\): Promise<UndoExtra> \{\s*const p = await prisma\.product\.findUnique\(/);
  for (const f of ["app/api/admin/product/bulk/route.ts", "app/api/admin/product/variation/route.ts"]) assert.ok(!/description/.test(src(f)), f);
});
