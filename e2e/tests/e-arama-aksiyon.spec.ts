import { test, expect, openOk } from "../fixtures";

type P = import("@playwright/test").Page;
interface ApiProduct {
  id: string;
  title: string;
  variations: { id: string; stock: number }[];
}

const topInput = (page: P) => page.getByLabel("Ürün adı, model kodu veya stok kodu ile ara").and(page.locator(":visible"));

async function pick(request: import("@playwright/test").APIRequestContext, multi: boolean, minStock = 1): Promise<ApiProduct | null> {
  const res = await request.get(`/api/search?q=${encodeURIComponent("avize")}`);
  const list = ((await res.json()) as { products: ApiProduct[] }).products;
  return list.find((p) => (multi ? p.variations.length > 1 && p.variations.some((v) => v.stock > 0) : p.variations.length === 1 && p.variations[0].stock >= minStock)) ?? null;
}

const cartQty = (page: P) =>
  page.evaluate(() => {
    try {
      const items = JSON.parse(localStorage.getItem("yildirim_cart") ?? "[]") as { quantity: number }[];
      return items.reduce((n, i) => n + i.quantity, 0);
    } catch {
      return 0;
    }
  });

async function typeBig(page: P, text: string) {
  const box = page.getByLabel("Avize ara");
  await expect(async () => {
    await box.fill(text, { timeout: 3000 });
    await expect(box).toHaveValue(text, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
}

async function typeTop(page: P, mobile: boolean, text: string) {
  await expect(async () => {
    if (mobile && !(await topInput(page).count())) await page.getByRole("button", { name: "Ürün ara" }).first().click();
    await topInput(page).fill(text, { timeout: 3000 });
    await expect(topInput(page)).toHaveValue(text, { timeout: 2000 });
  }).toPass({ timeout: 25_000 });
}

test.describe("e) Arama listelerinde ürün aksiyonları (salt okunur)", () => {
  test("büyük liste: 'Sepete Ekle' yazısına ve + düğmesine basmak sepete ekler", async ({ page, request }) => {
    const p = await pick(request, false, 2);
    test.skip(!p, "stoğu en az 2 olan tek seçenekli ürün yok");
    await openOk(page, "/");
    await typeBig(page, p!.title);
    const row = page.locator("div.absolute div.p-3").filter({ has: page.locator(`a[href="/urun/${p!.id}"]`) }).first();
    await expect(row).toBeVisible();
    // Kullanıcının bastığı şey: ortadaki "Sepete Ekle" yazısı
    await row.getByRole("button", { name: "Sepete Ekle" }).click();
    await expect.poll(() => cartQty(page), { message: "'Sepete Ekle' sonrası sepet adedi" }).toBe(1);
    await row.getByRole("button", { name: "Adedi artır" }).click();
    await expect.poll(() => cartQty(page)).toBe(2);
    await expect(page).not.toHaveURL(/\/urun\//);
    await expect(row).toBeVisible(); // liste kapanmadı
  });

  test("üst arama: kalp ve + çalışır, liste kapanmaz, ürüne gitmez", async ({ page, request }, info) => {
    const p = await pick(request, false);
    test.skip(!p, "stokta tek seçenekli ürün yok");
    const mobile = info.project.name === "mobile";
    await openOk(page, "/");
    await typeTop(page, mobile, p!.title);
    const list = page.getByRole("listbox", { name: "Arama sonuçları" });
    const row = list.locator("li").filter({ has: page.locator(`a[href="/urun/${p!.id}"]`) }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Favorilere ekle" }).click();
    await expect(row.getByRole("button", { name: "Favorilerden çıkar" })).toBeVisible();
    await row.getByRole("button", { name: "Adedi artır" }).click();
    await expect.poll(() => cartQty(page)).toBe(1);
    await expect(list).toBeVisible();
    await expect(page).not.toHaveURL(/\/urun\//);
    // Dokunma hedefleri
    for (const name of ["Favorilerden çıkar", "Adedi artır"]) {
      const box = await row.getByRole("button", { name }).boundingBox();
      expect(box!.width, name).toBeGreaterThanOrEqual(mobile ? 40 : 28);
      expect(box!.height, name).toBeGreaterThanOrEqual(mobile ? 40 : 28);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "yatay taşma").toBeLessThanOrEqual(0);
    // Favoriyi geri al (yalnızca tarayıcı depolaması)
    await row.getByRole("button", { name: "Favorilerden çıkar" }).click();
    // Satırın ürün bağlantısı yine ürüne gider
    // (Toast bildirimleri satırın üstünü örtebilir: klavyeyle etkinleştirilir)
    await row.locator(`a[href="/urun/${p!.id}"]`).press("Enter");
    await expect(page).toHaveURL(/\/urun\//);
  });

  test("seçenekli üründe + sepete eklemez, ürün sayfasına yönlendirir", async ({ page, request }, info) => {
    const p = await pick(request, true);
    test.skip(!p, "stokta çok seçenekli ürün yok");
    const mobile = info.project.name === "mobile";
    await openOk(page, "/");
    await typeTop(page, mobile, p!.title);
    const row = page.getByRole("listbox", { name: "Arama sonuçları" }).locator("li").filter({ has: page.locator(`a[href="/urun/${p!.id}"]`) }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Adedi artır" }).click();
    await expect(page).toHaveURL(new RegExp(`/urun/${p!.id}`));
    expect(await cartQty(page)).toBe(0);
  });

  test("390 px: büyük ve üst arama listesinde yatay taşma yok", async ({ page, request }) => {
    const p = await pick(request, false);
    test.skip(!p, "ürün yok");
    await page.setViewportSize({ width: 390, height: 844 });
    await openOk(page, "/");
    await typeBig(page, p!.title);
    await expect(page.locator("div.absolute div.p-3").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "yatay taşma").toBeLessThanOrEqual(0);
  });
});
