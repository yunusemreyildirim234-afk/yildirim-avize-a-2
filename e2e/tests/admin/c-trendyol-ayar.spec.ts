import { test, expect } from "../../fixtures";
import { expandPanel, openAdmin, restoreHomepageConfig, settleStorefront } from "../../admin-helpers";
import { exec, rows } from "../../db";

// Trendyol alan modlarının KAYDI: SiteConfig.homepageConfig.trendyolSyncModes. Kayıtlı değer formu yalnızca doldurur.
// Trendyol'a hiçbir istek atılmaz ("Önizle" tıklanmaz). Ayar sonda ESKİ haline getirilir.
let originalConfig: unknown = null;
const FIYAT = "Fiyat (satış, liste, varyasyon farkı)";
const radio = (page: import("@playwright/test").Page, field: string, mode: string) => page.getByRole("radio", { name: `${field}: ${mode}`, exact: true });
const saved = async () => ((await rows<{ c: unknown }>(`select "homepageConfig" -> 'trendyolSyncModes' as c from "SiteConfig" where id = 1`))[0]?.c ?? null) as Record<string, string> | null;
const setRaw = (v: unknown) =>
  exec(`update "SiteConfig" set "homepageConfig" = jsonb_set(coalesce("homepageConfig",'{}'::jsonb), '{trendyolSyncModes}', $1::jsonb) where id = 1`, [JSON.stringify(v)]);
const clearRaw = () => exec(`update "SiteConfig" set "homepageConfig" = coalesce("homepageConfig",'{}'::jsonb) - 'trendyolSyncModes' where id = 1`);

test.describe.configure({ mode: "serial" });

test.describe("Trendyol ayarları kalıcı", () => {
  test.beforeAll(async () => {
    originalConfig = (await rows<{ homepageConfig: unknown }>(`select "homepageConfig" from "SiteConfig" where id = 1`))[0]?.homepageConfig ?? null;
    await clearRaw();
  });
  test.afterAll(async ({ request }) => {
    await restoreHomepageConfig(originalConfig);
    await settleStorefront(request);
  });

  test("kayıt yokken varsayılan; değiştirip kaydet → yenileyince geri gelir; Ezerek uyarısı", async ({ page }) => {
    await openAdmin(page);
    await expandPanel(page, /Trendyol Ürünleri/);
    await expect(radio(page, "Stok", "Trendyol'daki değeri yaz")).toBeChecked();
    await expect(page.getByTestId("ezerek-uyari")).toHaveCount(0);
    await expect(page.getByTestId("ayar-kaydet")).toBeDisabled();

    await radio(page, FIYAT, "Trendyol'daki değeri yaz").check();
    await radio(page, "Görseller", "Elle değiştirdiklerimi koru").check();
    await expect(page.getByTestId("ayar-durum")).toContainText("Kaydedilmemiş");
    await page.getByTestId("ayar-kaydet").click();
    await expect(page.getByTestId("ayar-durum")).toContainText("kaydedildi");
    expect(await saved()).toMatchObject({ STOCK: "OVERWRITE", PRICE: "OVERWRITE", IMAGES: "KEEP", TEXT: "SKIP" });

    await page.reload();
    await expandPanel(page, /Trendyol Ürünleri/);
    await expect(radio(page, FIYAT, "Trendyol'daki değeri yaz")).toBeChecked();
    await expect(radio(page, "Görseller", "Elle değiştirdiklerimi koru")).toBeChecked();
    await expect(radio(page, "Başlık ve açıklama", "Dokunma")).toBeChecked();
    await expect(page.getByTestId("ezerek-uyari")).toBeVisible();
    await expect(page.getByTestId("ezerek-uyari")).toContainText("Fiyat");
  });

  test("varsayılana dönüp kaydedince kayıt silinir", async ({ page }) => {
    await setRaw({ STOCK: "KEEP", PRICE: "SKIP", TEXT: "SKIP", IMAGES: "SKIP", CATEGORY: "SKIP", VARIANT_INFO: "SKIP", ACTIVE: "SKIP" });
    await openAdmin(page);
    await expandPanel(page, /Trendyol Ürünleri/);
    await expect(radio(page, "Stok", "Elle değiştirdiklerimi koru")).toBeChecked();
    await expect(page.getByTestId("ezerek-uyari")).toHaveCount(0);
    await radio(page, "Stok", "Trendyol'daki değeri yaz").check();
    await page.getByTestId("ayar-kaydet").click();
    await expect(page.getByTestId("ayar-durum")).toContainText("kaydedildi");
    expect(await saved()).toBeNull();
  });

  test("bozuk kayıt → varsayılanlar (sayfa çökmez)", async ({ page }) => {
    for (const bad of ["bozuk", 42, [], { STOCK: "YANLIS", PRICE: 7 }]) {
      await setRaw(bad);
      await openAdmin(page);
      await expandPanel(page, /Trendyol Ürünleri/);
      await expect(radio(page, "Stok", "Trendyol'daki değeri yaz")).toBeChecked();
      await expect(radio(page, FIYAT, "Dokunma")).toBeChecked();
    }
  });

  test("geçersiz kaydetme isteği 400 döner, kayıt değişmez", async ({ request }) => {
    await clearRaw();
    const res = await request.put("/api/admin/trendyol/sync", { data: { ayarlar: { STOCK: "OVERWRITE" } } });
    expect(res.status()).toBe(400);
    expect(await saved()).toBeNull();
  });
});
