import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect } from "../../fixtures";
import { expandPanel, openAdmin, refreshStorefront } from "../../admin-helpers";
import { exec, rows } from "../../db";

// Ekran görüntüleri (yalnızca E2E_EKRAN=1 ile): Aktif/Pasif düğmeleri, istisna kutusu, toplu Aktif/Pasif sekmesi, Stok Azaldı Rozeti ayarı, kart ve ürün sayfası rozeti.
// 1280 / 390 px, açık / koyu. Çıktı: test-results/ekran-yeni/. Veri "E2E Yeni" önekli, sonda silinir; ayar eski haline döner.
const KAT = "E2E Yeni Kat";
const SLUG = "e2e-yeni-kat";
const POLL = { timeout: 40_000, intervals: [1000, 2000, 3000] };
const OUT = "test-results/ekran-yeni";
const id = { off: "", low: "" };
let originalConfig: unknown = null;

async function insert(title: string, active: boolean, stock: number, price: number, listPrice: number | null = null) {
  const [p] = await rows<{ id: string }>(`insert into "Product" (id, title, category, "basePrice", "listPrice", active, "updatedAt") values (gen_random_uuid()::text, $1, $2, $3, $4, $5, now()) returning id`, [title, KAT, price, listPrice, active]);
  await exec(`insert into "ProductVariation" (id, "productId", "variationType", "variationValue", stock) values (gen_random_uuid()::text, $1, 'Renk', 'Altın', $2)`, [p.id, stock]);
  return p.id;
}
const lowStock = (request: APIRequestContext, enabled: boolean) => request.post("/api/admin/categories", { data: { action: "lowStock", key: "*", enabled, threshold: 3 } });
const shot = async (page: Page, file: string, full = false) => page.screenshot({ path: `${OUT}/${file}.png`, fullPage: full });

test.skip(!process.env.E2E_EKRAN, "ekran görüntüsü yalnızca E2E_EKRAN=1 ile alınır");
test.describe.configure({ mode: "serial" });

const MODES = [
  { name: "1280-acik", w: 1280, h: 900, scheme: "light" as const },
  { name: "1280-koyu", w: 1280, h: 900, scheme: "dark" as const },
  { name: "390-acik", w: 390, h: 844, scheme: "light" as const },
  { name: "390-koyu", w: 390, h: 844, scheme: "dark" as const },
];

test.describe("Yeni özellik ekran görüntüleri", () => {
  test.beforeAll(async ({ request }) => {
    originalConfig = (await rows<{ homepageConfig: unknown }>(`select "homepageConfig" from "SiteConfig" where id = 1`))[0]?.homepageConfig ?? null;
    id.off = await insert("E2E Yeni Pasif Stoklu Avize", false, 4, 2900);
    id.low = await insert("E2E Yeni Son Adet Avize", true, 2, 3800, 4500);
    await refreshStorefront(request, id.low);
    expect((await lowStock(request, true)).status()).toBe(200);
  });
  test.afterAll(async ({ request }) => {
    await lowStock(request, false).catch(() => {});
    await exec(`delete from "Product" where title like 'E2E Yeni%'`).catch(() => {});
    const now = (await rows<{ homepageConfig: unknown }>(`select "homepageConfig" from "SiteConfig" where id = 1`))[0]?.homepageConfig ?? null;
    expect(now).toEqual(originalConfig);
  });

  for (const m of MODES) {
    test(`ekran: ${m.name}`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: m.w, height: m.h });
      await page.emulateMedia({ colorScheme: m.scheme });
      // Vitrin: kart ve ürün sayfası rozeti
      await expect
        .poll(async () => { await page.goto(`/kategori/${SLUG}`); return page.getByTestId("son-adet-rozet").count(); }, POLL)
        .toBeGreaterThan(0);
      await page.locator("div.group", { has: page.locator(`a[href="/urun/${id.low}"]`) }).first().screenshot({ path: `${OUT}/${m.name}-kart-son-adet.png` });
      await page.goto(`/urun/${id.low}`);
      await shot(page, `${m.name}-urun-son-adet`);
      // Yönetici: ayar bölümü
      await openAdmin(page);
      const form = page.getByTestId("stok-rozeti-form");
      await form.scrollIntoViewIfNeeded();
      await form.screenshot({ path: `${OUT}/${m.name}-admin-stok-rozeti-ayari.png` });
      // Yönetici: ürün satırı (rozet + Vitrine al), düzenleme (Durum + istisna), toplu Aktif/Pasif sekmesi
      await expandPanel(page, /^Tüm Ürünler/);
      await page.getByLabel("Ürün ismi, stok kodu veya model kodu ile ara").fill("E2E Yeni Pasif");
      const row = page.locator(`#ap-${id.off}`);
      await row.scrollIntoViewIfNeeded();
      await row.screenshot({ path: `${OUT}/${m.name}-admin-vitrine-al.png` });
      await row.getByRole("button", { name: "Düzenle" }).click();
      await expect(page.getByTestId("stoksuz-gizle")).toBeVisible({ timeout: 30_000 }); // düzenleyici tam görseller gelince açılır
      await row.screenshot({ path: `${OUT}/${m.name}-admin-duzenle-durum.png` });
      await page.getByLabel("E2E Yeni Pasif Stoklu Avize seç").check();
      await page.locator('button[aria-controls="admin-selection-detail"]').click();
      await page.getByRole("button", { name: "Aktif/Pasif", exact: true }).click();
      await page.locator("#admin-selection-detail").screenshot({ path: `${OUT}/${m.name}-admin-toplu-aktif-pasif.png` });
    });
  }
});
