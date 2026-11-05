import zlib from "node:zlib";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "./fixtures";
import { exec, rows } from "./db";

// ---- Küçük PNG üretici (e2e içinde, dosya gerektirmez) ----
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** size×size düz renkli geçerli PNG. Her renk farklı baytlar → farklı görsel kaydı. */
export function solidPng(r: number, g: number, b: number, size = 48): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => [r, g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

export const png = (r: number, g: number, b: number, name = "foto.png") => ({ name, mimeType: "image/png", buffer: solidPng(r, g, b) });

// ---- Ortak ----
export const E2E = "E2E ";
export const uniq = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 4);

/** Sayfadaki alert/confirm iletişim kutularını kabul eder ve metinlerini toplar. */
export function autoDialogs(page: Page): string[] {
  const messages: string[] = [];
  page.on("dialog", (d) => {
    messages.push(d.message());
    void d.accept();
  });
  return messages;
}

/** /admin açar; bölümü (başlık metniyle) genişletir. */
export async function openAdmin(page: Page) {
  const h1 = page.getByRole("heading", { level: 1 }).first();
  // Veritabanı bağlantı zaman aşımında (Neon) /admin hata sayfası ("Sayfa şu an açılamadı") verebilir: birkaç kez yeniden dene.
  for (let i = 0; i < 5; i++) {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await h1.waitFor();
    if (/Operasyon/.test((await h1.textContent()) ?? "")) return;
    await page.waitForTimeout(3000);
  }
  await expect(h1).toContainText("Operasyon");
}

export async function expandPanel(page: Page, headingText: string | RegExp) {
  const btn = page.getByRole("button", { name: headingText }).first();
  await btn.waitFor();
  if ((await btn.getAttribute("aria-expanded")) !== "true") await btn.click();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
}

/** Yönetim API'si (oturum çerezli) üzerinden ürün silme — temizlik için. Yoksa sessiz. */
export async function apiDeleteProduct(request: APIRequestContext, productId: string) {
  await request.delete("/api/admin/product", { data: { productId } }).catch(() => {});
}


/** Ürünü yönetim API'siyle siler (arayüzün çağırdığı uç) ve ürüne bağsız kalan yüklenmiş görselleri temizler. Ürün yoksa sessiz. */
export async function deleteE2eProduct(request: APIRequestContext, productId: string) {
  const imgs = await rows<{ id: string }>(`select id from "ProductImage" where "productId" = $1`, [productId]).catch(() => []);
  await apiDeleteProduct(request, productId);
  if (imgs.length) await exec(`delete from "ProductImage" where id = any($1) and "productId" is null`, [imgs.map((i) => i.id)]).catch(() => {});
}

/** Başlığı önekle başlayan tüm E2E ürünleri siler (afterAll güvenlik ağı; aksi halde kalıntı denetimi başarısız olur). */
export async function cleanupE2eProducts(request: APIRequestContext, titlePrefix: string) {
  const list = await rows<{ id: string }>(`select id from "Product" where title like $1`, [`${titlePrefix}%`]).catch(() => []);
  for (const p of list) await deleteE2eProduct(request, p.id);
}

/** Depolama önbelleğini yenilemek için: hiçbir şeyi değiştirmeyen başarılı bir yönetici isteği (PATCH aynı başlık). */
export async function refreshStorefront(request: APIRequestContext, productId: string) {
  const [p] = await rows<{ title: string }>(`select title from "Product" where id = $1`, [productId]);
  const res = await request.patch("/api/admin/product", { data: { productId, title: p.title } });
  expect(res.ok(), "vitrin yenileme (aynı başlıkla PATCH)").toBe(true);
}

/** Yeni avize formunu açıp doldurur ve gönderir. photos: ürün (genel) fotoğrafları; colors: ad, stok, kendi fotoğrafları. */
export async function createProductViaForm(
  page: Page,
  opts: { title: string; category?: string; newCategory?: string; price?: string; photos?: ReturnType<typeof png>[]; colors?: { name: string; stock?: string; photos?: ReturnType<typeof png>[] }[] }
) {
  const form = page.locator("form", { has: page.getByRole("button", { name: "Avizeyi Vitrinde Yayınla" }) });
  if (!(await form.isVisible().catch(() => false))) await page.getByRole("button", { name: "+ Yeni Avize Ekle" }).click();
  await expect(form).toBeVisible();
  await form.getByLabel("Avize Adı").fill(opts.title);
  if (opts.newCategory) {
    await form.locator("select").selectOption("__new__");
    await form.getByLabel("Yeni kategori adı").fill(opts.newCategory);
  } else if (opts.category) await form.locator("select").selectOption(opts.category);
  await form.getByLabel("Fiyat", { exact: true }).fill(opts.price ?? "1234");
  if (opts.photos?.length) await form.locator('input[type="file"]').first().setInputFiles(opts.photos);
  const colors = opts.colors ?? [{ name: "E2E Renk" }];
  for (let i = 0; i < colors.length; i++) {
    if (i > 0) await form.getByRole("button", { name: "+ Renk Ekle" }).click();
    const row = form.locator("fieldset > div").nth(i);
    await row.getByLabel("Renk adı").fill(colors[i].name);
    await row.getByLabel("Stok (adet)").fill(colors[i].stock ?? "5");
    if (colors[i].photos?.length) await row.locator('input[type="file"]').setInputFiles(colors[i].photos!);
  }
  await form.getByRole("button", { name: "Avizeyi Vitrinde Yayınla" }).click();
}

/** "Tüm Ürünler" panelini açar ve aramayla yalnızca verilen ürüne daraltır. */
export async function findInProductList(page: Page, title: string) {
  await expandPanel(page, /Tüm Ürünler • Avize Kataloğu/);
  await page.getByLabel("Ürün ismi, stok kodu veya model kodu ile ara").fill(title);
}

/** Kategori anahtarı (lib/categories.ts categoryKey ile aynı kural). */
export const catKey = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR").replace(/ı/g, "i");

/** "E2e ..." önekli (kullanıcı ekli) kategorileri yönetim API'siyle siler; ürünler kategorisiz kalır (ardından ürünler silinir). */
export async function cleanupE2eCategories(request: APIRequestContext) {
  const cats = await rows<{ category: string }>(`select distinct category from "Product" where category ilike 'e2e %'`).catch(() => []);
  for (const c of cats) await request.post("/api/admin/categories", { data: { action: "delete", key: catKey(c.category) } }).catch(() => {});
}
