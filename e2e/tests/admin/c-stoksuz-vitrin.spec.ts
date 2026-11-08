import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect } from "../../fixtures";
import { expandPanel, openAdmin, refreshStorefront } from "../../admin-helpers";
import { exec, rows } from "../../db";

// "Stoksuz ürünleri vitrinde Tükendi olarak göster" ayarı (genel + kategori bazlı). Yalnızca "E2E " önekli ürün/kategori üretilir; ayar sonda ESKİ haline getirilir.
const KAT = "E2E Stoksuz Kat"; // aktif + pasif ürünler birlikte
const KAT2 = "E2E Stoksuz Diger"; // yalnızca pasif+stoksuz ürün (menü / kategori sayısı testi)
const SLUG = "e2e-stoksuz-kat";
const SLUG2 = "e2e-stoksuz-diger";
const KEY2 = "e2e stoksuz diger";
const POLL = { timeout: 40_000, intervals: [1000, 2000, 3000] };

const T = { sold: "E2E Stoksuz Pasif", inStock: "E2E Stoksuz Stoklu Aktif", stockedOff: "E2E Stoksuz Stoklu Pasif", other: "E2E Stoksuz Diger Pasif" };
const id: Record<keyof typeof T, string> = { sold: "", inStock: "", stockedOff: "", other: "" };
let originalConfig: unknown = null;

async function insert(title: string, category: string, active: boolean, stock: number, price: number, flags = false) {
  const [p] = await rows<{ id: string }>(
    `insert into "Product" (id, title, category, "basePrice", active, "isFeatured", "isBestSeller", "updatedAt") values (gen_random_uuid()::text, $1, $2, $3, $4, $5, $5, now()) returning id`,
    [title, category, price, active, flags]
  );
  await exec(`insert into "ProductVariation" (id, "productId", "variationType", "variationValue", stock) values (gen_random_uuid()::text, $1, 'Renk', 'Altın', $2)`, [p.id, stock]);
  return p.id;
}

const setGlobal = async (request: APIRequestContext, value: boolean) => {
  const r = await request.post("/api/admin/categories", { data: { action: "stocklessGlobal", key: "*", value } });
  expect(r.status()).toBe(200);
};
const setCat = async (request: APIRequestContext, key: string, value: "show" | "hide" | null) => {
  const r = await request.post("/api/admin/categories", { data: { action: "stockless", key, value } });
  expect(r.status()).toBe(200);
};
const status = async (request: APIRequestContext, path: string) => (await request.get(path, { maxRedirects: 0 })).status();
const cardOrder = async (page: Page, path: string) => {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  return page.locator('main a[href^="/urun/"]').evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!.replace("/urun/", "")))]);
};
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe.configure({ mode: "serial" });

test.describe("Stoksuz ürünler vitrinde Tükendi", () => {
  test.beforeAll(async ({ request }) => {
    originalConfig = (await rows<{ homepageConfig: unknown }>(`select "homepageConfig" from "SiteConfig" where id = 1`))[0]?.homepageConfig ?? null;
    id.sold = await insert(T.sold, KAT, false, 0, 9000, true); // pahalı + vitrin işaretli: ana sayfada yine de görünmemeli
    id.inStock = await insert(T.inStock, KAT, true, 5, 100);
    id.stockedOff = await insert(T.stockedOff, KAT, false, 3, 500);
    id.other = await insert(T.other, KAT2, false, 0, 700);
    await refreshStorefront(request, id.inStock);
  });

  test.afterAll(async ({ request }) => {
    await setGlobal(request, false).catch(() => {});
    await setCat(request, KEY2, null).catch(() => {});
    await setCat(request, "e2e stoksuz kat", null).catch(() => {});
    await exec(`delete from "Product" where title like 'E2E Stoksuz%'`).catch(() => {});
    // Ayar ESKİ haline döndü mü?
    const now = (await rows<{ homepageConfig: unknown }>(`select "homepageConfig" from "SiteConfig" where id = 1`))[0]?.homepageConfig ?? null;
    expect(now, "homepageConfig eski haline döndü").toEqual(originalConfig);
  });

  test("varsayılan KAPALI: pasif+stoksuz gizli, sayfası 404, listede / sitemap'te yok (mevcut davranış korundu)", async ({ request, page }) => {
    await setGlobal(request, false);
    await expect.poll(() => status(request, `/urun/${id.sold}`), POLL).toBe(404);
    expect(await status(request, `/urun/${id.stockedOff}`)).toBe(404);
    expect(await status(request, `/urun/${id.inStock}`)).toBe(200);
    await expect.poll(async () => (await cardOrder(page, `/kategori/${SLUG}`)).sort(), POLL).toEqual([id.inStock]);
    await expect.poll(async () => (await (await request.get("/sitemap.xml")).text()).includes(id.sold), POLL).toBe(false);
    expect(await status(request, `/kategori/${SLUG2}`)).toBe(404); // yalnızca pasif ürünlü eklenen kategori listede yok
  });

  test("genel ayarı yönetici arayüzünden aç: önbellek temizlenir, ürün sayfası 200, liste/arama/sitemap'te görünür, stoklu önce", async ({ page, request }) => {
    await openAdmin(page);
    await expandPanel(page, /^Kategoriler/);
    const box = page.getByTestId("stoksuz-genel");
    await expect(box).not.toBeChecked();
    const [res] = await Promise.all([page.waitForResponse((r) => r.url().includes("/api/admin/categories") && r.request().method() === "POST", { timeout: 60_000 }), box.click()]);
    expect(res.status()).toBe(200);

    await expect.poll(() => status(request, `/urun/${id.sold}`), POLL).toBe(200);
    expect(await status(request, `/urun/${id.stockedOff}`), "pasif + STOKLU ürün ayar açık olsa da gizli").toBe(404);
    // kategori listesi: stoklu önce
    await expect.poll(() => cardOrder(page, `/kategori/${SLUG}`), POLL).toEqual([id.inStock, id.sold]);
    // sıralama ne olursa olsun stoklu önde (fiyat azalan olsa pahalı stoksuz arkada kalır)
    expect(await cardOrder(page, `/kategori/${SLUG}?siralama=fiyat-azalan`)).toEqual([id.inStock, id.sold]);
    expect(await cardOrder(page, `/kategori/${SLUG}?siralama=fiyat-artan`)).toEqual([id.inStock, id.sold]);
    expect((await cardOrder(page, "/kategori/tum?adet=96")).includes(id.stockedOff)).toBe(false);
    // arama
    expect(await cardOrder(page, `/arama?q=${encodeURIComponent(T.sold)}`)).toContain(id.sold);
    expect(await cardOrder(page, `/arama?q=${encodeURIComponent("E2E Stoksuz")}`)).not.toContain(id.stockedOff);
    // sitemap
    await expect.poll(async () => (await (await request.get("/sitemap.xml")).text()).includes(`/urun/${id.sold}`), POLL).toBe(true);
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain(`/urun/${id.stockedOff}`);
    // kategori sayısı / menü (alt bilgi): yalnızca stoksuz ürünlü kategori listede belirir
    await expect
      .poll(async () => {
        await page.goto("/");
        return page.locator(`footer a[href="/kategori/${SLUG2}"]`).count();
      }, POLL)
      .toBe(1);
    expect(await status(request, `/kategori/${SLUG2}`)).toBe(200);
  });

  test("ana sayfa vitrinleri, Çok Satanlar/Öne Çıkanlar sayfaları ve benzer ürünler stoksuzu göstermez", async ({ page }) => {
    const hrefs = async (path: string) => page.goto(path).then(() => page.locator(`a[href="/urun/${id.sold}"]`).count());
    expect(await hrefs("/")).toBe(0);
    expect(await hrefs("/kategori/cok-satanlar")).toBe(0);
    expect(await hrefs("/kategori/one-cikanlar")).toBe(0);
    // aktif ürünün sayfasındaki "Benzer Avize Modelleri" aynı kategoriden stoksuzu içermez
    await page.goto(`/urun/${id.inStock}`);
    await expect(page.locator(`a[href="/urun/${id.sold}"]`)).toHaveCount(0);
  });

  test("kart: Tükendi rozeti, soluk görsel, sepete ekle yok, kalp çalışır", async ({ page }) => {
    await page.goto(`/kategori/${SLUG}`);
    const card = page.locator("[data-soldout='true']", { has: page.locator(`a[href="/urun/${id.sold}"]`) });
    await expect(card).toHaveCount(1);
    await expect(card.getByText("Tükendi").first()).toBeVisible();
    await expect(card.getByRole("button", { name: /Sepete|artır/i })).toHaveCount(0);
    await expect(card.getByText("9.000,00 ₺")).toBeVisible(); // fiyat görünür
    const fav = card.getByRole("button", { name: "Favorilere ekle" });
    await fav.click();
    await expect(card.getByRole("button", { name: "Favorilerden çıkar" })).toHaveAttribute("aria-pressed", "true");
    await card.getByRole("button", { name: "Favorilerden çıkar" }).click();
  });

  test("ürün sayfası: 200, Tükendi rozeti, satın alma yok, WhatsApp stok sorma, JSON-LD OutOfStock, noindex değil, favori çalışır", async ({ page }) => {
    const res = await page.goto(`/urun/${id.sold}`);
    expect(res!.status()).toBe(200);
    await expect(page.getByTestId("tukendi-rozet")).toBeVisible();
    await expect(page.getByText("Bu ürün şu an stokta yok")).toBeVisible();
    await expect(page.getByTestId("stok-yok-bolumu")).toBeVisible();
    await expect(page.locator("main div.rounded-3xl").first().getByRole("button", { name: /^(Sepete Ekle|Stokta Yok|Adedi artır|Adedi azalt)$/ })).toHaveCount(0); // satın alma bölümü (adet + sepete ekle) yok
    const wa = page.getByTestId("stok-sor");
    const href = (await wa.getAttribute("href"))!;
    expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    const text = decodeURIComponent(href.split("?text=")[1]);
    expect(text).toContain(`'${T.sold}' ürününün stoğu ne zaman gelir?`);
    expect(text).toContain(`/urun/${id.sold}`);
    const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
    expect(ld).toContain("https://schema.org/OutOfStock");
    expect(ld).not.toContain("https://schema.org/InStock");
    expect(await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.getAttribute("content") ?? "").join(","))).not.toMatch(/noindex/);
    const fav = page.getByTestId("favori-ekle");
    await fav.click();
    await expect(fav).toHaveAttribute("aria-pressed", "true");
    await fav.click();
    // stoklu ürün sayfası eskisi gibi: satın alma bölümü var, JSON-LD InStock
    await page.goto(`/urun/${id.inStock}`);
    await expect(page.getByRole("button", { name: "Sepete Ekle" })).toBeVisible();
    expect(await page.locator('script[type="application/ld+json"]').allTextContents().then((a) => a.join(""))).toContain("https://schema.org/InStock");
  });

  test("sepet ve sipariş: stoksuz görünen ürün sepete/siparişe alınmaz", async ({ playwright, baseURL }) => {
    const [v] = await rows<{ id: string }>(`select id from "ProductVariation" where "productId" = $1`, [id.sold]);
    const ctx = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const quote = await ctx.post("/api/cart/quote", { data: { items: [{ variationId: v.id, qty: 1 }], deliveryMethod: "STANDART_KARGO", paymentMethod: "BANK_TRANSFER" } });
    expect(quote.status()).toBeLessThan(500);
    expect(JSON.stringify(await quote.json())).toContain('"available":false');
    const order = await ctx.post("/api/order", {
      data: { name: "E2E Müşteri", email: "e2e-stoksuz@example.invalid", phone: "0500 000 00 03", address: "E2E Test Mah. No:3", shippingType: "STANDART_KARGO", paymentMethod: "BANK_TRANSFER", consent: true, items: [{ variationId: v.id, quantity: 1 }] },
    });
    if (order.status() === 429) test.info().annotations.push({ type: "ATLANDI-hiz-siniri", description: "/api/order hız sınırı doldu; sepet quote doğrulandı" });
    else {
      expect(order.status()).toBe(400);
      expect(((await order.json()) as { error: string }).error).toContain("artık satışta değil");
    }
    const created = await rows<{ n: number }>(`select count(*)::int as n from "OrderItem" where "variationId" = $1`, [v.id]);
    expect(created[0].n, "sipariş kalemi oluşmadı").toBe(0);
    await ctx.dispose();
  });

  test("'Sadece stokta olanlar' filtresi: yalnızca stoklular, noindex, çip; stoksuz yoksa kutu görünmez", async ({ page, request }) => {
    await page.goto(`/kategori/${SLUG}`);
    await expect(page.getByTestId("stok-filtre")).toBeVisible();
    expect(await cardOrder(page, `/kategori/${SLUG}?stok=var`)).toEqual([id.inStock]);
    expect(await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.getAttribute("content") ?? "").join(","))).toMatch(/noindex/);
    await expect(page.getByRole("link", { name: "Sadece stokta olanlar filtresini kaldır" })).toBeVisible();
    // ayar kapanınca (stoksuz görünen ürün yok) kutu da yok
    await setGlobal(request, false);
    await expect
      .poll(async () => {
        await page.goto(`/kategori/${SLUG}`);
        return page.getByTestId("stok-filtre").count();
      }, POLL)
      .toBe(0);
  });

  test("kategori bazlı 'Gizle' genel 'Göster'i ezer; kategori bazlı 'Göster' genel kapalıyken çalışır", async ({ request, page }) => {
    await setGlobal(request, true);
    await setCat(request, KEY2, "hide");
    await expect.poll(() => status(request, `/urun/${id.other}`), POLL).toBe(404);
    expect(await status(request, `/urun/${id.sold}`), "başka kategori genel ayarı izler").toBe(200);
    await setGlobal(request, false);
    await setCat(request, KEY2, "show");
    await expect.poll(() => status(request, `/urun/${id.other}`), POLL).toBe(200);
    expect(await status(request, `/urun/${id.sold}`), "genel kapalı: öteki kategori gizli").toBe(404);
    await expect
      .poll(async () => {
        await page.goto("/");
        return page.locator(`footer a[href="/kategori/${SLUG2}"]`).count();
      }, POLL)
      .toBe(1);
    await setCat(request, KEY2, null);
    await expect.poll(() => status(request, `/urun/${id.other}`), POLL).toBe(404);
  });

  test("yönetici ürün listesi: 'Stoğu var ama pasif' rozeti + filtre; 'Vitrinde Tükendi olarak görünür' notu", async ({ page, request }) => {
    await setGlobal(request, true);
    await openAdmin(page);
    await expandPanel(page, /^Tüm Ürünler/);
    await page.getByLabel("Ürün ismi, stok kodu veya model kodu ile ara").fill("E2E Stoksuz");
    const offStocked = page.locator(`#ap-${id.stockedOff}`);
    await expect(offStocked.getByTestId("stoklu-pasif-rozet")).toContainText("Stoğu var ama pasif: vitrinde görünmüyor");
    await expect(page.locator(`#ap-${id.sold}`).getByTestId("vitrinde-tukendi-notu")).toBeVisible();
    await expect(page.locator(`#ap-${id.inStock}`).getByTestId("stoklu-pasif-rozet")).toHaveCount(0);
    await page.getByRole("button", { name: /Stoğu var ama pasif/ }).first().click();
    await expect(page.locator(`#ap-${id.stockedOff}`)).toBeVisible();
    await expect(page.locator(`#ap-${id.sold}`)).toHaveCount(0);
  });

  test("mobil 390 px: taşma yok, Stok durumunu sor düğmesi >= 40 px, kart/filtre düzeni bozulmaz", async ({ page, request }) => {
    await setGlobal(request, true);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => status(request, `/urun/${id.sold}`), POLL).toBe(200);
    await page.goto(`/urun/${id.sold}`);
    expect(await overflow(page), "ürün sayfası yatay taşma").toBeLessThanOrEqual(0);
    const box = await page.getByTestId("stok-sor").boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(40);
    await page.goto(`/kategori/${SLUG}`);
    expect(await overflow(page), "liste yatay taşma").toBeLessThanOrEqual(0);
    await page.getByTestId("filtre-ac").click();
    await expect(page.getByTestId("stok-filtre")).toBeVisible();
    expect((await page.getByTestId("stok-filtre").boundingBox())!.height).toBeGreaterThanOrEqual(40);
  });
});
