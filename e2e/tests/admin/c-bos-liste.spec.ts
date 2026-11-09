import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect, menuLinks, productLinks } from "../../fixtures";
import { restoreHomepageConfig, settleStorefront } from "../../admin-helpers";
import { rows } from "../../db";

// Kategori ayarı değişip geri alındıktan hemen sonra liste boş gelmemeli (menü, liste ve kartlar aynı etiketle birlikte yenilenir).
// Veri üretmez; yalnızca kategori ayarını değiştirir ve sonda homepageConfig'i aynen geri yükler.
const keyOf = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR").replace(/ı/g, "i");
const setHidden = async (request: APIRequestContext, key: string, hidden: boolean | null) => {
  const res = await request.post("/api/admin/categories", { data: { action: "setting", key, hidden } });
  expect(res.status(), "kategori ayarı").toBe(200);
};
const cardCount = async (page: Page, slug: string) => {
  await page.goto(`/kategori/${slug}`);
  return productLinks(page).count();
};

test.describe("Önbellek tutarlılığı: ayar değişimi sonrası liste", () => {
  let original: unknown = null;

  test.beforeAll(async () => {
    original = (await rows<{ homepageConfig: unknown }>(`select "homepageConfig" from "SiteConfig" where id = 1`))[0]?.homepageConfig ?? null;
  });

  test.afterAll(async ({ request }) => {
    await restoreHomepageConfig(original);
    await settleStorefront(request);
  });

  test("kategori gizlenip geri açılınca liste boş gelmez, menüyle birlikte hemen güncellenir", async ({ page, request }) => {
    await page.goto("/");
    const slugs = (await menuLinks(page)).map((l) => l.href.replace(/^\/kategori\//, "")).filter((s) => s !== "tum");
    test.skip(slugs.length === 0, "e2e veritabanında kategori yok");
    const slug = slugs[0];
    const before = await cardCount(page, slug);
    expect(before, "başlangıçta kart var").toBeGreaterThan(0);
    const heading = (await page.locator("main h1").first().innerText()).trim();
    const [row] = await rows<{ category: string }>(
      `select category from "Product" where active = true and lower(replace(category, 'ı', 'i')) = lower(replace($1, 'ı', 'i')) limit 1`,
      [slug === "sarkit" ? "Sarkıt" : slug.replace(/-/g, " ")],
    );
    const key = keyOf(row?.category ?? heading);

    await setHidden(request, key, true);
    // Bekleme yok: yenileme hemen sona erer, sonraki istek menüyü taze okur
    await page.goto("/");
    expect((await menuLinks(page)).some((l) => l.href === `/kategori/${slug}`), "gizli kategori menüde yok").toBe(false);

    await setHidden(request, key, null);
    await page.goto("/");
    expect((await menuLinks(page)).some((l) => l.href === `/kategori/${slug}`), "geri açılan kategori menüde").toBe(true);
    for (let i = 0; i < 5; i++) expect(await cardCount(page, slug), `yenileme ${i + 1}: liste boş olmamalı`).toBe(before);
  });
});
