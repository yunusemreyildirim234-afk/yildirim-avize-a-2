import type { Page } from "@playwright/test";
import { test, expect, openOk, productLinks, realImageUrl } from "../fixtures";

const gallerySignature = async (page: Page): Promise<string> => {
  const thumbs = page.getByRole("tablist", { name: "Ürün fotoğrafları" }).getByRole("tab").locator("img");
  if ((await thumbs.count()) > 0) return (await thumbs.evaluateAll((els) => els.map((i) => (i as HTMLImageElement).getAttribute("src") ?? ""))).join("|");
  const main = page.locator(`main img[alt]`).first();
  return (await main.getAttribute("src")) ?? "";
};

async function firstProductHref(page: Page): Promise<string> {
  await openOk(page, "/kategori/tum");
  const n = await productLinks(page).count();
  test.skip(n === 0, "e2e veritabanında ürün yok");
  return (await productLinks(page).first().getAttribute("href"))!;
}

test.describe("c) Ürün sayfası", () => {
  test("başlık ve fiyat satırları (vitrin kuponu, Havale %, Mağaza %) görünür", async ({ page }) => {
    const href = await firstProductHref(page);
    await openOk(page, href);
    await expect(page.locator("h1")).not.toHaveText("");
    const main = page.locator("main");
    // Ana fiyat
    await expect(main.getByText(/\d[\d.]*,\d{2}\s?₺|\d[\d.]*\s?₺/).first()).toBeVisible();
    // Fiyat merdiveni adımları: ürünün kurallarına göre bazıları olmayabilir; yoksa test notu düşülür
    const coupon = main.getByText(/\S+ kuponuyla/);
    const bank = main.getByText(/\+ Havale\/EFT ile \(%\d+/);
    const pickup = main.getByText(/\+ Mağazadan teslimle \(%\d+/);
    const found = { coupon: (await coupon.count()) > 0, bank: (await bank.count()) > 0, pickup: (await pickup.count()) > 0 };
    test.info().annotations.push({ type: "fiyat-satirlari", description: JSON.stringify(found) });
    expect(found.bank || found.pickup || found.coupon, "fiyat merdiveninde hiç indirim satırı yok").toBe(true);
    if (found.bank) await expect(bank.first()).toBeVisible();
    if (found.pickup) await expect(pickup.first()).toBeVisible();
    if (found.coupon) {
      const code = ((await coupon.first().innerText()).match(/(\S+) kuponuyla/) ?? [])[1];
      expect(code, "vitrin kupon kodu").toMatch(/^[A-Z0-9_-]{3,32}$/);
    }
  });

  test("genel galeriyle açılır: ürün sayfasının ilk görseli listedeki kart kapağıyla aynı", async ({ page }) => {
    await openOk(page, "/kategori/tum");
    test.skip((await productLinks(page).count()) === 0, "ürün yok");
    const card = page.locator("div:has(> a[href^='/urun/'])").first();
    const href = (await productLinks(page).first().getAttribute("href"))!;
    const cardImg = realImageUrl(await card.locator("img").first().getAttribute("src").catch(() => null));
    test.skip(!cardImg, "ilk kartın görseli yok");
    await openOk(page, href);
    const sig = await gallerySignature(page);
    const first = realImageUrl(sig.split("|")[0]);
    // Kart kapağı = genel fotoğrafın ilki (yoksa ilk rengin fotoğrafı). Sayfa da aynı görselle açılmalı.
    expect(first, "ürün sayfası galerisinin ilk görseli").toBeTruthy();
    expect(first).toBe(cardImg);
  });

  test("çok renkli ürün: renk seçince galeri değişir (rengin kendi fotoğrafı varsa)", async ({ page }) => {
    await openOk(page, "/kategori/tum");
    const hrefs = (await productLinks(page).evaluateAll((els) => els.map((a) => a.getAttribute("href") ?? ""))).filter((h, i, a) => a.indexOf(h) === i).slice(0, 15);
    test.skip(hrefs.length === 0, "ürün yok");
    let tested = false;
    for (const href of hrefs) {
      await openOk(page, href);
      const radios = page.getByRole("radiogroup").getByRole("radio");
      const n = await radios.count();
      if (n < 2) continue;
      const before = await gallerySignature(page);
      for (let i = 0; i < n; i++) {
        const r = radios.nth(i);
        if (await r.isDisabled()) continue;
        await r.click();
        await expect(r).toHaveAttribute("aria-checked", "true");
        const after = await gallerySignature(page);
        if (after !== before) {
          tested = true;
          break;
        }
      }
      if (tested) break;
    }
    test.skip(!tested, "rengine özel fotoğrafı olan çok renkli ürün bulunamadı");
    expect(tested).toBe(true);
  });
});
