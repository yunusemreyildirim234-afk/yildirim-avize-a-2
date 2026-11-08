import type { Page } from "@playwright/test";
import { test, expect } from "../../fixtures";
import { exec, rows } from "../../db";

// Misafir sepeti localStorage'da varyasyon adı kopyası tutar; yönetici adı değiştirince sepet sayfası yenilenince yeni ad görünmeli,
// ürün sayfasının "Seçenek: " tür öneki korunmalı ve ad değişmediyse sepet kaydı yeniden yazılmamalı.
// Yalnızca "E2E Sepet Ad" önekli ürün üretilir ve sonda silinir. Sipariş verilmez.
const TITLE = "E2E Sepet Ad Avize";
let pid = "";

const quoteDone = (page: Page) => page.waitForResponse((r) => r.url().includes("/api/cart/quote") && r.request().method() === "POST");
const stored = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem("yildirim_cart") ?? "[]") as { variationName: string }[]).map((i) => i.variationName));
const writes = (page: Page) => page.evaluate(() => (window as unknown as { __cartWrites: number }).__cartWrites);

/** /sepet'i açar; sunucu teklifi gelip işlenene kadar bekler; o yüklemedeki sepet yazım sayısını döner. */
async function openCart(page: Page) {
  const [q] = await Promise.all([quoteDone(page), page.goto("/sepet", { waitUntil: "domcontentloaded" })]);
  expect(q.status()).toBe(200);
  await page.waitForTimeout(700); // teklif işlenir, olası yazım tamamlanır
  return writes(page);
}

test.describe.configure({ mode: "serial" });

test.describe("Sepette güncel varyasyon adı", () => {
  test.beforeAll(async () => {
    const [p] = await rows<{ id: string }>(`insert into "Product" (id, title, category, "basePrice", active, "updatedAt") values (gen_random_uuid()::text, $1, 'E2E Sepet Kat', 900, true, now()) returning id`, [TITLE]);
    pid = p.id;
    await exec(`insert into "ProductVariation" (id, "productId", "variationType", "variationValue", stock) values (gen_random_uuid()::text, $1, 'Seçenek', 'Bej', 5)`, [pid]);
  });
  test.afterAll(async () => {
    await exec(`delete from "Product" where title like 'E2E Sepet Ad%'`).catch(() => {});
  });

  test("yönetici adı değiştirince misafir sepetinde yeni ad görünür, önek korunur; ad değişmeyince ek yazım olmaz", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] }, locale: "tr-TR", viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      const w = window as unknown as { __cartWrites: number };
      w.__cartWrites = 0;
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k === "yildirim_cart") w.__cartWrites++;
        return orig.call(this, k, v);
      };
    });

    // Ürün sayfasından ekle: ad "Seçenek: Bej" olarak kaydedilir
    await page.goto(`/urun/${pid}`);
    await page.getByRole("button", { name: /^Sepete Ekle$/ }).click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Sepete eklendi" }).first()).toBeVisible();
    expect(await stored(page)).toEqual(["Seçenek: Bej"]);

    // Ad değişmedi: iki yükleme de aynı sayıda yazım yapar (isim güncellemesi ek yazım üretmez)
    await openCart(page); // ilk yükleme: sunucu fiyat/kural bilgisi sepete işlenir (ek yazım olabilir); taban ölçümü sonraki yüklemelerle yapılır
    const a = await openCart(page);
    const b = await openCart(page);
    expect(b).toBe(a);
    await expect(page.getByText("Seçenek: Bej")).toBeVisible();

    // Yönetici varyasyon adını değiştirir (doğrudan e2e veritabanı)
    await exec(`update "ProductVariation" set "variationValue" = 'Krem' where "productId" = $1`, [pid]);
    const c = await openCart(page);
    await expect(page.getByText("Seçenek: Krem")).toBeVisible();
    await expect(page.getByText("Seçenek: Bej")).toHaveCount(0);
    expect(await stored(page)).toEqual(["Seçenek: Krem"]); // tür öneki korundu
    expect(c).toBe(a + 1); // yalnızca ad değişince bir ek yazım

    // Sonraki yüklemede yine ek yazım yok
    expect(await openCart(page)).toBe(a);

    // Öneksiz (hızlı ekleme) kayıt öneksiz kalır
    await page.evaluate(() => {
      const cart = JSON.parse(localStorage.getItem("yildirim_cart") ?? "[]");
      cart[0].variationName = "Bej";
      localStorage.setItem("yildirim_cart", JSON.stringify(cart));
    });
    await openCart(page);
    expect(await stored(page)).toEqual(["Krem"]);
    await ctx.close();
  });
});
