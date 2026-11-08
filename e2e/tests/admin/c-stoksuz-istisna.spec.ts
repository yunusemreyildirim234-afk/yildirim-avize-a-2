import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect } from "../../fixtures";
import { expandPanel, openAdmin } from "../../admin-helpers";
import { exec, rows } from "../../db";

// Ürün bazlı istisna: "Stoksuz olduğunda vitrinde gösterme" (homepageConfig.stocklessHiddenIds). Genel "Stoksuz ürünleri göster" açıkken
// işaretli pasif+stoksuz ürün gizlenir; kaldırılınca görünür; aktif ürünler etkilenmez. Yalnızca "E2E İstisna" önekli ürünler; ayar sonda eski haline döner.
const KAT = "E2E Istisna Kat";
const KAT2 = "E2E Istisna Diger"; // yalnızca bir pasif+stoksuz ürün (menü / kategori sayısı)
const SLUG = "e2e-istisna-kat";
const SLUG2 = "e2e-istisna-diger";
const POLL = { timeout: 40_000, intervals: [1000, 2000, 3000] };
const T = { p1: "E2E Istisna P1 Pasif Stoksuz", p2: "E2E Istisna P2 Pasif Stoksuz", p3: "E2E Istisna P3 Aktif", p4: "E2E Istisna P4 Diger Pasif" };
const id: Record<keyof typeof T, string> = { p1: "", p2: "", p3: "", p4: "" };
let originalConfig: unknown = null;

async function insert(title: string, category: string, active: boolean, stock: number) {
  const [p] = await rows<{ id: string }>(`insert into "Product" (id, title, category, "basePrice", active, "updatedAt") values (gen_random_uuid()::text, $1, $2, 800, $3, now()) returning id`, [title, category, active]);
  await exec(`insert into "ProductVariation" (id, "productId", "variationType", "variationValue", stock) values (gen_random_uuid()::text, $1, 'Renk', 'Altın', $2)`, [p.id, stock]);
  return p.id;
}
const setGlobal = async (request: APIRequestContext, value: boolean) => expect((await request.post("/api/admin/categories", { data: { action: "stocklessGlobal", key: "*", value } })).status()).toBe(200);
const setHidden = async (request: APIRequestContext, productId: string, stocklessHidden: boolean) => (await request.patch("/api/admin/product", { data: { productId, stocklessHidden } })).status();
const status = async (request: APIRequestContext, path: string) => (await request.get(path, { maxRedirects: 0 })).status();
const sitemap = async (request: APIRequestContext) => (await request.get("/sitemap.xml")).text();
const cardIds = async (page: Page, path: string) => {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  return page.locator('main a[href^="/urun/"]').evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!.replace("/urun/", "")))]);
};
const footerLinks = async (page: Page, slug: string) => {
  await page.goto("/");
  return page.locator(`footer a[href="/kategori/${slug}"]`).count();
};
const storedIds = async () => (await rows<{ ids: unknown }>(`select "homepageConfig"->'stocklessHiddenIds' as ids from "SiteConfig" where id = 1`))[0]?.ids ?? null;

test.describe.configure({ mode: "serial" });

test.describe("Stoksuz ürün istisnası", () => {
  test.beforeAll(async ({ request }) => {
    originalConfig = (await rows<{ homepageConfig: unknown }>(`select "homepageConfig" from "SiteConfig" where id = 1`))[0]?.homepageConfig ?? null;
    id.p1 = await insert(T.p1, KAT, false, 0);
    id.p2 = await insert(T.p2, KAT, false, 0);
    id.p3 = await insert(T.p3, KAT, true, 3);
    id.p4 = await insert(T.p4, KAT2, false, 0);
    await setGlobal(request, true);
  });
  test.afterAll(async ({ request }) => {
    for (const k of ["p1", "p2", "p3", "p4"] as const) if (id[k]) await setHidden(request, id[k], false).catch(() => {});
    await setGlobal(request, false).catch(() => {});
    await exec(`delete from "Product" where title like 'E2E Istisna%'`).catch(() => {});
    const now = (await rows<{ homepageConfig: unknown }>(`select "homepageConfig" from "SiteConfig" where id = 1`))[0]?.homepageConfig ?? null;
    expect(now, "homepageConfig eski haline döndü").toEqual(originalConfig);
  });

  test("ayar açık: pasif+stoksuz iki ürün de görünür; sunucu doğrulaması (boolean, var olan ürün)", async ({ request, page }) => {
    await expect.poll(() => status(request, `/urun/${id.p1}`), POLL).toBe(200);
    expect(await status(request, `/urun/${id.p2}`)).toBe(200);
    await expect.poll(async () => (await cardIds(page, `/kategori/${SLUG}`)).sort(), POLL).toEqual([id.p3, id.p1, id.p2].sort());
    expect((await request.patch("/api/admin/product", { data: { productId: id.p1, stocklessHidden: "evet" } })).status()).toBe(400);
    expect(await setHidden(request, "yok-boyle-bir-urun", true)).toBe(404);
    expect(await storedIds()).toBeNull();
  });

  test("yönetici kutusu: işaretlenince yalnızca o ürün gizlenir (sayfa, liste, arama, sitemap); not görünür; kaldırılınca geri gelir", async ({ page, request, context }) => {
    const shop = await context.newPage(); // vitrin kontrolleri ayrı sekmede: yönetici sayfası açık kalır
    await openAdmin(page);
    await expandPanel(page, /^Tüm Ürünler/);
    await page.getByLabel("Ürün ismi, stok kodu veya model kodu ile ara").fill(T.p1);
    await page.locator(`#ap-${id.p1}`).getByRole("button", { name: "Düzenle" }).click();
    const box = page.getByTestId("stoksuz-gizle");
    await expect(box).not.toBeChecked();
    await expect(page.locator(`#ap-${id.p1}`)).toContainText("Kategori ayarı açık olsa bile bu ürün stoğu bittiğinde vitrinde görünmez");
    expect((await box.boundingBox())!.height).toBeGreaterThan(0);

    const [res] = await Promise.all([page.waitForResponse((r) => r.url().includes("/api/admin/product") && r.request().method() === "PATCH"), box.click()]);
    expect(res.status()).toBe(200);
    expect(await storedIds()).toEqual([id.p1]);
    await expect(page.getByTestId("stoksuz-istisna-notu")).toBeVisible();
    await expect(box).toBeChecked();

    await expect.poll(() => status(request, `/urun/${id.p1}`), POLL).toBe(404);
    expect(await status(request, `/urun/${id.p2}`), "işaretsiz kardeş ürün görünür kalır").toBe(200);
    expect(await status(request, `/urun/${id.p3}`), "aktif ürün etkilenmez").toBe(200);
    expect((await cardIds(shop, `/kategori/${SLUG}`)).sort()).toEqual([id.p3, id.p2].sort());
    expect(await cardIds(shop, `/arama?q=${encodeURIComponent("E2E Istisna P")}`)).not.toContain(id.p1);
    await expect.poll(async () => (await sitemap(request)).includes(`/urun/${id.p1}`), POLL).toBe(false); // sitemap önbelleği
    await expect.poll(async () => (await sitemap(request)).includes(`/urun/${id.p2}`), POLL).toBe(true);

    // kaldır: tekrar görünür
    const [res2] = await Promise.all([page.waitForResponse((r) => r.url().includes("/api/admin/product") && r.request().method() === "PATCH"), box.click()]);
    expect(res2.status()).toBe(200);
    expect(await storedIds()).toBeNull();
    await expect.poll(() => status(request, `/urun/${id.p1}`), POLL).toBe(200);
    await expect.poll(async () => (await sitemap(request)).includes(`/urun/${id.p1}`), POLL).toBe(true);
    await shop.close();
  });

  test("kategori/menü sayısı tutarlı: kategorinin tek stoksuz ürünü istisna olunca kategori kalkar, kaldırılınca geri gelir", async ({ request, page }) => {
    await expect.poll(() => footerLinks(page, SLUG2), POLL).toBe(1);
    expect(await status(request, `/kategori/${SLUG2}`)).toBe(200);

    expect(await setHidden(request, id.p4, true)).toBe(200);
    await expect.poll(() => footerLinks(page, SLUG2), POLL).toBe(0);
    await expect.poll(() => status(request, `/kategori/${SLUG2}`), POLL).toBe(404);
    expect(await status(request, `/urun/${id.p4}`)).toBe(404);
    await expect.poll(async () => (await sitemap(request)).includes(`/kategori/${SLUG2}`), POLL).toBe(false);

    expect(await setHidden(request, id.p4, false)).toBe(200);
    await expect.poll(() => footerLinks(page, SLUG2), POLL).toBe(1);
    await expect.poll(() => status(request, `/kategori/${SLUG2}`), POLL).toBe(200);
  });

  test("aktif ürün istisna listesinde olsa da görünür; pasife alınınca (stoksuz) gizlenir; liste temizlenir", async ({ request }) => {
    expect(await setHidden(request, id.p3, true)).toBe(200);
    expect(await status(request, `/urun/${id.p3}`)).toBe(200);
    expect(await setHidden(request, id.p1, true)).toBe(200);
    expect((await storedIds() as string[]).sort()).toEqual([id.p1, id.p3].sort());
    await exec(`update "ProductVariation" set stock = 0 where "productId" = $1`, [id.p3]);
    expect((await request.patch("/api/admin/product", { data: { productId: id.p3, active: false } })).status()).toBe(200);
    await expect.poll(() => status(request, `/urun/${id.p3}`), POLL).toBe(404); // pasif + stoksuz + istisnalı
    expect(await setHidden(request, id.p3, false)).toBe(200);
    await expect.poll(() => status(request, `/urun/${id.p3}`), POLL).toBe(200); // istisna kalktı → "Tükendi" olarak görünür
    expect(await setHidden(request, id.p1, false)).toBe(200);
    expect(await storedIds()).toBeNull();
  });

  test("mobil (390 px): istisna kutusu taşma yapmaz", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAdmin(page);
    await expandPanel(page, /^Tüm Ürünler/);
    await page.getByLabel("Ürün ismi, stok kodu veya model kodu ile ara").fill(T.p2);
    await page.locator(`#ap-${id.p2}`).getByRole("button", { name: "Düzenle" }).click();
    const box = page.getByTestId("stoksuz-gizle");
    await expect(box).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
});
