import { test, expect } from "../fixtures";

// Arama yazım toleransı (salt okunur). Katalogda "avize" ürünleri bulunduğu varsayılır (e-search.spec.ts ile aynı).
test.describe("e) Arama: otomatik düzeltme", () => {
  test('/arama?q=avzie düzeltilmiş "avize" sonuçlarını ve düzeltme satırını gösterir', async ({ page }) => {
    await page.goto("/arama?q=avzie");
    const row = page.getByTestId("arama-duzeltme");
    await expect(row).toContainText("“avzie” için sonuç bulunamadı");
    await expect(row).toContainText("“avize” sonuçları gösteriliyor");
    await expect(page.locator('a[href^="/urun/"]').first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page).toHaveTitle(/avzie/);
  });

  test('"Yine de ara" düzeltmesiz arar (tam=1): satır kaybolur, sonuç yok', async ({ page }) => {
    await page.goto("/arama?q=avzie");
    await page.getByRole("link", { name: /Yine de .avzie. ara/ }).click();
    await expect(page).toHaveURL(/q=avzie&tam=1/);
    await expect(page.getByTestId("arama-duzeltme")).toHaveCount(0);
    await expect(page.getByText("Aradığınız ürün bulunamadı")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("karışık harf ve kod benzeri kelime: zivae düzelir, e28 olduğu gibi aranır", async ({ page, request }) => {
    await page.goto("/arama?q=zivae");
    await expect(page.getByTestId("arama-duzeltme")).toContainText("“avize” sonuçları gösteriliyor");
    const res = await request.get(`/api/search?q=${encodeURIComponent("avzie e28")}`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { corrected?: string };
    if (body.corrected) expect(body.corrected).toMatch(/e28/); // kod kelimesi başka koda çevrilmez
  });

  test("API: 0 sonuçta düzeltilmiş ürünler ve corrected alanı", async ({ request }) => {
    const res = await request.get(`/api/search?q=${encodeURIComponent("avzie")}`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { products: { id: string }[]; corrected?: string };
    expect(body.corrected).toBe("avize");
    expect(body.products.length).toBeGreaterThan(0);
  });

  test('üst arama kutusu: "avzie" için "avize" ürünlerini ve "için gösteriliyor" satırını gösterir', async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel("Ürün adı, model kodu veya stok kodu ile ara").and(page.locator(":visible"));
    await expect(async () => {
      await input.fill("avzie", { timeout: 3000 });
      await expect(page.getByText("için gösteriliyor")).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 25_000 });
    await expect(page.getByRole("listbox", { name: "Arama sonuçları" })).toBeVisible();
  });
});
