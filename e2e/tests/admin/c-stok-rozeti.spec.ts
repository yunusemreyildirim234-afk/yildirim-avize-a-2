import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect } from "../../fixtures";
import { openAdmin, refreshStorefront, restoreHomepageConfig, settleStorefront } from "../../admin-helpers";
import { exec, rows } from "../../db";

// "Stok azaldı rozeti" ("Son N adet"): genel anahtar (varsayılan KAPALI) + eşik (1..10). Yalnızca gerçek stoktan; Tükendi ve eşik üstünde rozet yok.
// Yalnızca "E2E Rozet" önekli ürünler üretilir ve sonda silinir; ayar sonda ESKİ haline getirilir.
const KAT = "E2E Rozet Kat";
const SLUG = "e2e-rozet-kat";
const POLL = { timeout: 40_000, intervals: [1000, 2000, 3000] };
type Key = "tek" | "bir" | "cok" | "bol" | "tukendi";
const T: Record<Key, string> = { tek: "E2E Rozet Tek Iki", bir: "E2E Rozet Bir", cok: "E2E Rozet Cok Renk", bol: "E2E Rozet Bol", tukendi: "E2E Rozet Tukendi" };
const id = {} as Record<Key, string>;
let originalConfig: unknown = null;

async function insert(title: string, variations: [string, number][]) {
  const [p] = await rows<{ id: string }>(`insert into "Product" (id, title, category, "basePrice", active, "updatedAt") values (gen_random_uuid()::text, $1, $2, 1200, true, now()) returning id`, [title, KAT]);
  let pos = 0;
  for (const [name, stock] of variations) {
    await exec(`insert into "ProductVariation" (id, "productId", "variationType", "variationValue", stock, position) values (gen_random_uuid()::text, $1, 'Renk', $2, $3, $4)`, [p.id, name, stock, pos++]);
  }
  return p.id;
}
const saveSetting = async (request: APIRequestContext, enabled: boolean, threshold: number) =>
  request.post("/api/admin/categories", { data: { action: "lowStock", key: "*", enabled, threshold } });
const card = (page: Page, pid: string) => page.locator("div.group", { has: page.locator(`a[href="/urun/${pid}"]`) }).first();
const cardBadge = async (page: Page, pid: string) => card(page, pid).getByTestId("son-adet-rozet").allTextContents();
// Ürün sayfasındaki asıl rozet (fiyat yanı); "benzer ürünler" kartlarındaki rozetler (absolute) hariç
const pageBadge = (page: Page) => page.locator('[data-testid="son-adet-rozet"].align-middle');

test.describe.configure({ mode: "serial" });

test.describe("Son N adet stok rozeti", () => {
  test.beforeAll(async () => {
    originalConfig = (await rows<{ homepageConfig: unknown }>(`select "homepageConfig" from "SiteConfig" where id = 1`))[0]?.homepageConfig ?? null;
    id.tek = await insert(T.tek, [["Altın", 2]]);
    id.bir = await insert(T.bir, [["Altın", 1]]);
    id.cok = await insert(T.cok, [["Altın", 2], ["Krom", 20]]); // toplam 22: kartta rozet yok; sayfada seçili varyasyona göre
    id.bol = await insert(T.bol, [["Altın", 5]]);
    id.tukendi = await insert(T.tukendi, [["Altın", 0]]);
  });
  test.afterAll(async ({ request }) => {
    await saveSetting(request, false, 3).catch(() => {});
    await exec(`delete from "Product" where title like 'E2E Rozet%'`).catch(() => {});
    await restoreHomepageConfig(originalConfig).catch(() => {});
    await settleStorefront(request);
    const now = (await rows<{ homepageConfig: unknown }>(`select "homepageConfig" from "SiteConfig" where id = 1`))[0]?.homepageConfig ?? null;
    expect(now, "homepageConfig eski haline döndü").toEqual(originalConfig);
  });

  test("varsayılan KAPALI: kartta ve ürün sayfasında rozet yok", async ({ page }) => {
    // Önbellek "eskiyken-yenile" çalışır (önceki koşudan kalan ayar olabilir): yoklayarak doğrula
    await expect.poll(async () => { await page.goto(`/kategori/${SLUG}`); return page.getByTestId("son-adet-rozet").count(); }, POLL).toBe(0);
    await expect.poll(async () => { await page.goto(`/urun/${id.tek}`); return pageBadge(page).count(); }, POLL).toBe(0);
  });

  test("yönetici ayarı (arayüz): açılıp eşik 3 kaydedilir; mobilde düğmeler ≥40 px", async ({ page }) => {
    await openAdmin(page);
    const form = page.getByTestId("stok-rozeti-form");
    await form.scrollIntoViewIfNeeded();
    await expect(form).toContainText("Yalnızca gerçek stok eşiğin altındaysa görünür. Trendyol ile stok ortak olduğu için eşitleme gecikmesi olabilir.");
    const box = page.getByTestId("stok-rozeti-acik");
    await expect(box).not.toBeChecked();
    await box.check();
    await expect(page.getByTestId("stok-rozeti-esik")).toHaveValue("3");
    expect((await form.getByRole("button", { name: "Kaydet" }).boundingBox())!.height).toBeGreaterThanOrEqual(40);
    const [res] = await Promise.all([page.waitForResponse((r) => r.url().includes("/api/admin/categories") && r.request().method() === "POST"), form.getByRole("button", { name: "Kaydet" }).click()]);
    expect(res.status()).toBe(200);
    const [cfg] = await rows<{ on: boolean | null; th: number | null }>(`select ("homepageConfig"->'lowStockBadge')::boolean as on, ("homepageConfig"->'lowStockThreshold')::int as th from "SiteConfig" where id = 1`);
    expect(cfg.on).toBe(true);
    expect(cfg.th).toBeNull(); // varsayılan eşik (3) kayıt edilmez
  });

  test("açık, eşik 3: kartta toplam stoğa göre rozet (1 → 'Son 1 adet', 2 → 'Son 2 adet'); eşik üstü ve Tükendi'de yok", async ({ page }) => {
    await expect.poll(async () => { await page.goto(`/kategori/${SLUG}`); return cardBadge(page, id.tek); }, POLL).toEqual(["Son 2 adet"]);
    expect(await cardBadge(page, id.bir)).toEqual(["Son 1 adet"]);
    expect(await cardBadge(page, id.cok), "toplam 22 > eşik").toEqual([]);
    expect(await cardBadge(page, id.bol), "stok 5 > eşik 3").toEqual([]);
    expect(await cardBadge(page, id.tukendi), "stok 0: rozet yok").toEqual([]);
    await expect(card(page, id.tukendi).locator("a span", { hasText: "Tükendi" })).toBeVisible();
    // Tükendi rozeti ve "Son N adet" aynı köşede ama birlikte asla çıkmaz
    for (const k of ["tek", "bir"] as const) await expect(card(page, id[k]).locator("a span", { hasText: "Tükendi" })).toHaveCount(0);
  });

  test("ürün sayfası: seçili varyasyonun stoğu; tek varyasyonda kendi stoğu; Tükendi'de yok; JSON-LD etkilenmez", async ({ page }) => {
    await page.goto(`/urun/${id.tek}`);
    await expect(pageBadge(page)).toHaveText("Son 2 adet");
    await page.goto(`/urun/${id.bir}`);
    await expect(pageBadge(page)).toHaveText("Son 1 adet");
    await page.goto(`/urun/${id.bol}`);
    await expect(pageBadge(page)).toHaveCount(0);
    await page.goto(`/urun/${id.tukendi}`);
    await expect(pageBadge(page)).toHaveCount(0);
    await expect(page.getByTestId("tukendi-rozet")).toBeVisible();

    await page.goto(`/urun/${id.cok}`);
    await page.getByRole("radio", { name: /Altın/ }).click();
    await expect(pageBadge(page)).toHaveText("Son 2 adet"); // seçili varyasyon: Altın (2)
    await page.getByRole("radio", { name: /Krom/ }).click();
    await expect(pageBadge(page)).toHaveCount(0); // Krom 20 > eşik
    await page.getByRole("radio", { name: /Altın/ }).click();
    await expect(pageBadge(page)).toHaveText("Son 2 adet");

    const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
    expect(ld).not.toMatch(/Son \d+ adet/);
    const html = await page.content();
    expect(html.match(/<meta[^>]+(name|property)="(description|og:description)"[^>]*>/g)?.join("") ?? "").not.toMatch(/Son \d+ adet/);
  });

  test("eşik değişimi: 5 → stok 5 ürün rozet alır; geçersiz eşik sunucuda reddedilir", async ({ request, page }) => {
    expect((await saveSetting(request, true, 11)).status()).toBe(400);
    expect((await saveSetting(request, true, 0)).status()).toBe(400);
    expect((await saveSetting(request, true, 2.5)).status()).toBe(400);
    expect((await request.post("/api/admin/categories", { data: { action: "lowStock", key: "*", enabled: "evet", threshold: 3 } })).status()).toBe(400);
    expect((await saveSetting(request, true, 5)).status()).toBe(200);
    await expect.poll(async () => { await page.goto(`/kategori/${SLUG}`); return cardBadge(page, id.bol); }, POLL).toEqual(["Son 5 adet"]);
    expect(await cardBadge(page, id.cok), "toplam 22 > 5").toEqual([]);
    await page.goto(`/urun/${id.bol}`);
    await expect(pageBadge(page)).toHaveText("Son 5 adet");
  });

  test("mobil (390 px): rozet kart içinde, taşma/çakışma yok (indirimli kartta da)", async ({ page, request }) => {
    await exec(`update "Product" set "listPrice" = 1500 where id = $1`, [id.tek]); // %20 İndirim rozeti sol üstte
    await refreshStorefront(request, id.tek); // doğrudan SQL önbelleği temizlemez
    await page.setViewportSize({ width: 390, height: 844 });
    const discountBadge = () => card(page, id.tek).locator("a span", { hasText: /^%\d+ İndirim$/ });
    await expect
      .poll(async () => { await page.goto(`/kategori/${SLUG}`); return (await cardBadge(page, id.tek)).length + (await discountBadge().count()); }, { ...POLL, timeout: 60_000 })
      .toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    const c = (await card(page, id.tek).boundingBox())!;
    const b = (await card(page, id.tek).getByTestId("son-adet-rozet").boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(c.x);
    expect(b.x + b.width).toBeLessThanOrEqual(c.x + c.width + 1);
    const d = (await discountBadge().boundingBox())!;
    expect(d.y + d.height <= b.y || b.y + b.height <= d.y, "indirim rozetiyle çakışmıyor").toBe(true);
    await page.goto(`/urun/${id.tek}`);
    await expect(pageBadge(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test("kapatınca rozetler kalkar", async ({ request, page }) => {
    expect((await saveSetting(request, false, 3)).status()).toBe(200);
    await expect.poll(async () => { await page.goto(`/kategori/${SLUG}`); return cardBadge(page, id.tek); }, POLL).toEqual([]);
    await page.goto(`/urun/${id.tek}`);
    await expect(pageBadge(page)).toHaveCount(0);
  });
});
