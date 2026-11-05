import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect } from "../../fixtures";
import { autoDialogs, expandPanel, openAdmin } from "../../admin-helpers";
import { exec, rows } from "../../db";

type Cfg = Record<string, unknown> | null;
const SECTIONS = ["featured", "discounted", "bestsellers"] as const;
const POLL = { timeout: 30_000, intervals: [1000, 2000, 3000] };

const readCfg = async (): Promise<Cfg> => (await rows<{ cfg: Cfg }>(`select "homepageConfig" as cfg from "SiteConfig" where id = 1`))[0]?.cfg ?? null;

/** Ana sayfa ayarını aynen geri yükler (veritabanı) ve vitrini yeniler (içeriği değiştirmeyen başarılı bir kayıtla). */
async function restoreHomepage(request: APIRequestContext, original: Cfg) {
  await exec(`update "SiteConfig" set "homepageConfig" = $1::jsonb where id = 1`, [original === null ? null : JSON.stringify(original)]);
  const key = SECTIONS.find((k) => original && original[k]);
  if (key) await request.put("/api/admin/homepage", { data: { [key]: original![key] } }); // {...mevcut, ...aynı değer}: değişiklik yok, yalnızca önbellek yenilenir
  expect(await readCfg(), "ana sayfa ayarı başlangıçtaki gibi geri yüklendi").toEqual(original);
}

async function openHomepagePanel(page: Page) {
  await openAdmin(page);
  await expandPanel(page, /Ana Sayfayı Düzenle/);
}

async function openSub(page: Page, id: string) {
  const btn = page.locator(`#${id}-h`);
  if ((await btn.getAttribute("aria-expanded")) !== "true") await btn.click();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
}

async function save(page: Page) {
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/admin/homepage") && r.request().method() === "PUT", { timeout: 60_000 }),
    page.locator("xpath=//span[contains(.,'Kaydedince ana sayfada hemen')]/preceding-sibling::button").click(),
  ]);
  expect(res.status(), "ana sayfa kaydı").toBe(200);
}

const homeHasLink = async (page: Page, slug: string) => {
  await page.goto("/");
  return (await page.locator(`main a[href="/kategori/${slug}"]`).count()) > 0;
};

test.describe("Admin ana sayfa ayarları", () => {
  test("kategori satırı: seç/çıkar, varsayılana dön; bölüm varsayılana dön; sonda ayar geri yüklenir", async ({ page, request }) => {
    const original = await readCfg();
    autoDialogs(page);
    try {
      await test.step("varsayılanda Klasik satırda var", async () => {
        await expect.poll(() => homeHasLink(page, "klasik"), POLL).toBe(true);
      });

      await test.step("Klasik'i çıkar → kaydet → ana sayfada yok", async () => {
        await openHomepagePanel(page);
        await openSub(page, "hp-collections");
        const box = page.locator("#hp-collections-panel fieldset label", { hasText: /Klasik/ }).getByRole("checkbox");
        await expect(box).toBeChecked();
        await expect(async () => { await box.uncheck(); }).toPass({ timeout: 15_000 }); // hidrasyon yarışına karşı yeniden dener
        await save(page);
        await expect.poll(() => homeHasLink(page, "klasik"), POLL).toBe(false);
        expect(((await readCfg())?.collections as string[]).includes("klasik")).toBe(false);
      });

      await test.step("Klasik'i yeniden seç → kaydet → ana sayfada var", async () => {
        await openHomepagePanel(page);
        await openSub(page, "hp-collections");
        const box = page.locator("#hp-collections-panel fieldset label", { hasText: /Klasik/ }).getByRole("checkbox");
        await expect(box).not.toBeChecked();
        await expect(async () => { await box.check(); }).toPass({ timeout: 15_000 });
        await save(page);
        await expect.poll(() => homeHasLink(page, "klasik"), POLL).toBe(true);
      });

      await test.step('"Varsayılana dön" → kaydet → özel seçim silinir', async () => {
        await openHomepagePanel(page);
        await openSub(page, "hp-collections");
        await page.locator("#hp-collections-panel").getByRole("button", { name: "Varsayılana dön" }).click();
        await expect(page.locator("#hp-collections-h")).toContainText("(varsayılan)");
        await save(page);
        expect((await readCfg())?.collections, "kayıtlı koleksiyon seçimi kalkmalı").toBeUndefined();
        await expect.poll(() => homeHasLink(page, "klasik"), POLL).toBe(true);
      });

      await test.step('bölüm "Varsayılana dön" (Öne Çıkanlar) kaydı siler', async () => {
        await openHomepagePanel(page);
        await openSub(page, "hp-featured");
        await page.locator("#hp-featured-panel").getByRole("button", { name: "Varsayılana dön" }).click();
        await save(page);
        expect((await readCfg())?.featured, "featured kaydı silinmeli").toBeUndefined();
      });
    } finally {
      await restoreHomepage(request, original);
    }
  });

  test("açılır bölümler kapatılıp açılınca veri kaybolmaz", async ({ page }) => {
    await openHomepagePanel(page);
    await openSub(page, "hp-featured");
    const count = page.locator("#hp-featured-panel").getByRole("spinbutton").first();
    const initial = await count.inputValue();
    const edited = String(Number(initial) === 7 ? 6 : 7);
    await count.fill(edited);

    // alt bölümü kapat/aç
    await page.locator("#hp-featured-h").click();
    await expect(page.locator("#hp-featured-h")).toHaveAttribute("aria-expanded", "false");
    await page.locator("#hp-featured-h").click();
    await expect(count).toHaveValue(edited);

    // başka alt bölümü aç/kapat
    await openSub(page, "hp-promo");
    await page.locator("#hp-promo-h").click();
    await expect(count).toHaveValue(edited);

    // tüm paneli kapat/aç
    const panelBtn = page.getByRole("button", { name: /Ana Sayfayı Düzenle/ }).first();
    await panelBtn.click();
    await expect(panelBtn).toHaveAttribute("aria-expanded", "false");
    await panelBtn.click();
    await openSub(page, "hp-featured");
    await expect(page.locator("#hp-featured-panel").getByRole("spinbutton").first()).toHaveValue(edited);
    // Kaydedilmedi: veritabanına yazılmadı
  });
});
