import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect } from "../../fixtures";
import { expandPanel, openAdmin, refreshStorefront } from "../../admin-helpers";
import { exec, rows } from "../../db";

// Ekran görüntüleri (yalnızca E2E_EKRAN=1 ile): Tükendi kartı, Tükendi ürün sayfası, admin Kategoriler anahtarları, "Stoğu var ama pasif" rozeti/filtresi,
// "Sadece stokta olanlar". 1280 / 390 px, açık / koyu. Çıktı: test-results/ekran-stoksuz/. Veri "E2E Ekran" önekli, sonda silinir; ayar eski haline döner.
const KAT = "E2E Ekran Kat";
const SLUG = "e2e-ekran-kat";
const POLL = { timeout: 40_000, intervals: [1000, 2000, 3000] };
const OUT = "test-results/ekran-stoksuz";
const id = { sold: "", inStock: "", stockedOff: "" };
let originalConfig: unknown = null;

async function insert(title: string, active: boolean, stock: number, price: number) {
  const [p] = await rows<{ id: string }>(`insert into "Product" (id, title, category, "basePrice", active, "updatedAt") values (gen_random_uuid()::text, $1, $2, $3, $4, now()) returning id`, [title, KAT, price, active]);
  await exec(`insert into "ProductVariation" (id, "productId", "variationType", "variationValue", stock) values (gen_random_uuid()::text, $1, 'Renk', 'Altın', $2)`, [p.id, stock]);
  return p.id;
}
const post = async (request: APIRequestContext, data: Record<string, unknown>) => expect((await request.post("/api/admin/categories", { data })).status()).toBe(200);
const status = async (request: APIRequestContext, path: string) => (await request.get(path, { maxRedirects: 0 })).status();

test.skip(!process.env.E2E_EKRAN, "ekran görüntüsü yalnızca E2E_EKRAN=1 ile alınır");
test.describe.configure({ mode: "serial" });

const MODES = [
  { name: "1280-acik", w: 1280, h: 900, scheme: "light" as const },
  { name: "1280-koyu", w: 1280, h: 900, scheme: "dark" as const },
  { name: "390-acik", w: 390, h: 844, scheme: "light" as const },
  { name: "390-koyu", w: 390, h: 844, scheme: "dark" as const },
];
const shot = async (page: Page, file: string, full = false) => page.screenshot({ path: `${OUT}/${file}.png`, fullPage: full });

test.describe("Stoksuz vitrin ekran görüntüleri", () => {
  test.beforeAll(async ({ request }) => {
    originalConfig = (await rows<{ homepageConfig: unknown }>(`select "homepageConfig" from "SiteConfig" where id = 1`))[0]?.homepageConfig ?? null;
    id.sold = await insert("E2E Ekran Tükenmiş Avize", false, 0, 4250);
    id.inStock = await insert("E2E Ekran Stoklu Avize", true, 4, 3800);
    id.stockedOff = await insert("E2E Ekran Stoklu Pasif Avize", false, 3, 2900);
    await refreshStorefront(request, id.inStock);
    await post(request, { action: "stocklessGlobal", key: "*", value: true });
  });
  test.afterAll(async ({ request }) => {
    await post(request, { action: "stocklessGlobal", key: "*", value: false }).catch(() => {});
    await exec(`delete from "Product" where title like 'E2E Ekran%'`).catch(() => {});
    const now = (await rows<{ homepageConfig: unknown }>(`select "homepageConfig" from "SiteConfig" where id = 1`))[0]?.homepageConfig ?? null;
    expect(now).toEqual(originalConfig);
  });

  for (const m of MODES) {
    test(`ekran: ${m.name}`, async ({ page, request }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: m.w, height: m.h });
      await page.emulateMedia({ colorScheme: m.scheme });
      await expect.poll(() => status(request, `/urun/${id.sold}`), POLL).toBe(200);
      await page.goto(`/kategori/${SLUG}`);
      await shot(page, `${m.name}-kart-tukendi`);
      await page.goto(`/urun/${id.sold}`);
      await shot(page, `${m.name}-urun-sayfasi-tukendi`, true);
      await page.goto(`/kategori/${SLUG}?stok=var`);
      if (m.w < 1024) {
        await page.getByTestId("filtre-ac").click();
        await shot(page, `${m.name}-sadece-stokta-olanlar-cekmece`);
        await page.keyboard.press("Escape");
      }
      await shot(page, `${m.name}-sadece-stokta-olanlar`);
      await openAdmin(page);
      await expandPanel(page, /^Kategoriler/);
      await page.getByTestId("stoksuz-genel").scrollIntoViewIfNeeded();
      await shot(page, `${m.name}-admin-kategoriler`);
      await expandPanel(page, /^Tüm Ürünler/);
      await page.getByLabel("Ürün ismi, stok kodu veya model kodu ile ara").fill("E2E Ekran");
      await page.getByTestId("stoklu-pasif-rozet").first().scrollIntoViewIfNeeded();
      await shot(page, `${m.name}-admin-stoklu-pasif-rozet`);
      await page.getByRole("button", { name: /Stoğu var ama pasif/ }).first().click();
      await shot(page, `${m.name}-admin-stoklu-pasif-filtre`);
    });
  }
});
