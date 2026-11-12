import type { Page } from "@playwright/test";
import { test, expect, openOk, productLinks, trNumber } from "../fixtures";

const toast = (page: Page) => page.locator("[data-sonner-toast]");

/** Listeden stokta olan ilk ürünü sepete ekler; ürün sayfasında kalır. Ladder'daki vitrin kodunu (varsa) döner. */
async function addFirstProduct(page: Page): Promise<{ href: string; showcaseCode: string | null }> {
  await openOk(page, "/kategori/tum");
  const hrefs = (await productLinks(page).evaluateAll((els) => els.map((a) => a.getAttribute("href") ?? ""))).filter((h, i, a) => a.indexOf(h) === i).slice(0, 12);
  test.skip(hrefs.length === 0, "e2e veritabanında ürün yok");
  for (const href of hrefs) {
    await openOk(page, href);
    const add = page.getByRole("button", { name: /^Sepete Ekle$/ });
    if ((await add.count()) === 0 || (await add.isDisabled())) continue;
    const ladder = await page.locator("main").getByText(/\S+ kuponuyla/).first().innerText().catch(() => "");
    await add.click();
    await expect(toast(page).filter({ hasText: "Sepete eklendi" }).first()).toBeVisible();
    return { href, showcaseCode: (ladder.match(/(\S+) kuponuyla/) ?? [])[1] ?? null };
  }
  test.skip(true, "stokta ürün bulunamadı");
  return { href: "", showcaseCode: null };
}

const row = (page: Page, label: string) => page.getByText(label, { exact: true }).locator("xpath=following-sibling::span[1]");

test.describe("d) Sepet", () => {
  test("Sepete ekle → toast; toast'a tıklayınca /sepet", async ({ page }) => {
    await addFirstProduct(page);
    const t = toast(page).filter({ hasText: "Sepete eklendi" }).first();
    await t.getByText("Sepete eklendi").click();
    await expect(page).toHaveURL(/\/sepet$/);
    await expect(page.getByText("Ürünler Toplamı")).toBeVisible();
  });

  test("oturumsuz sepet sayfa yenilenince korunur (hesaba eşitleme anonimde sepeti silmez)", async ({ page }) => {
    await addFirstProduct(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("yildirim_cart") ?? "[]").length);
    expect(stored).toBeGreaterThan(0);
    await openOk(page, "/sepet");
    await expect(page.getByText("Ürünler Toplamı")).toBeVisible();
    await expect(page.getByText("Sepetiniz Henüz Boş")).toHaveCount(0);
  });

  test("toast'taki × düğmesi yönlendirmez", async ({ page }) => {
    const { href } = await addFirstProduct(page);
    const t = toast(page).filter({ hasText: "Sepete eklendi" }).first();
    await t.locator("[data-close-button]").click();
    await expect(t).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[/.]/g, "\\$&")}$`));
  });

  test("sepette adet değiştirme, kaldırma ve Geri Al (Geri Al yönlendirmez); kupon yer tutucusu vitrin kodunu gösterir", async ({ page }) => {
    const { showcaseCode } = await addFirstProduct(page);
    await openOk(page, "/sepet");
    const qty = page.getByRole("button", { name: "+", exact: true }).first().locator("xpath=preceding-sibling::span[1]");
    await expect(qty).toHaveText("1");
    await page.getByRole("button", { name: "+", exact: true }).first().click();
    await expect(qty).toHaveText("2");
    await page.getByRole("button", { name: "-", exact: true }).first().click();
    await expect(qty).toHaveText("1");

    // Kupon alanı yer tutucusu sunucu teklifinden gelen vitrin kodunu gösterir
    const coupon = page.getByLabel("Kupon kodu");
    if (showcaseCode) await expect(coupon).toHaveAttribute("placeholder", `Promosyon kodu (${showcaseCode})`);
    else await expect(coupon).toHaveAttribute("placeholder", /Promosyon kodu/);

    // Kaldır → toast → Geri Al: ürün geri gelir, adres değişmez
    await page.getByTitle("Kaldır").first().click();
    await expect(page.getByText("Ürün sepetten çıkarıldı")).toBeVisible();
    await expect(page.getByText("Ürünler Toplamı")).toBeHidden();
    await toast(page).filter({ hasText: "Ürün sepetten çıkarıldı" }).getByRole("button", { name: /Geri Al/ }).click();
    await expect(page).toHaveURL(/\/sepet$/);
    await expect(page.getByText("Ürünler Toplamı")).toBeVisible();
    await expect(page.getByRole("button", { name: "+", exact: true }).first()).toBeVisible();
  });

  test("varsayılan teslimat adrese teslim; mağazadan teslim indirim bilgisiyle seçenek; alanlarda autocomplete", async ({ page }) => {
    await addFirstProduct(page);
    await openOk(page, "/sepet");
    await expect(page.getByText("Ürünler Toplamı")).toBeVisible();
    await expect(page.getByText(/^Mağazadan Teslim İndirimi/)).toHaveCount(0);
    await expect(page.getByLabel(/Açık Teslimat Adresiniz/)).toBeVisible();
    await expect(page.getByText(/Ücretsiz • %\d+ İndirim/)).toBeVisible();
    await expect(page.getByLabel(/Adınız Soyadınız/)).toHaveAttribute("autocomplete", "name");
    await expect(page.getByLabel("E-posta Adresiniz")).toHaveAttribute("autocomplete", "email");
    await expect(page.getByLabel(/Telefon Numaranız/)).toHaveAttribute("autocomplete", "tel");
    await expect(page.getByLabel(/Açık Teslimat Adresiniz/)).toHaveAttribute("autocomplete", "street-address");
    await expect(page.getByText(/Kargonomi/)).toHaveCount(0);
  });

  test("kargo satırı kurala uyar: 'Adrese Teslim'de ürün toplamı eşiğin altında ücretli, üstünde ücretsiz; mağazadan teslimde ücretsiz", async ({ page }) => {
    await addFirstProduct(page);
    await openOk(page, "/sepet");
    await expect(page.getByText("Ürünler Toplamı")).toBeVisible();
    await page.getByText("📦 Adrese Teslim").click();

    // Eşik değeri yalnızca arayüzden okunur ("350 ₺ ve üzeri siparişlerde kargo ücretsiz.")
    const ruleText = await page.getByText(/ve üzeri siparişlerde kargo ücretsiz/).first().innerText();
    const threshold = Number((ruleText.match(/(\d[\d.]*)\s?₺/) ?? [])[1]?.replace(/\./g, ""));
    expect(threshold, "arayüzdeki ücretsiz kargo eşiği").toBeGreaterThan(0);

    const check = async () => {
      // Teklif (sunucu) güncelleninceye kadar bekle: toplam ve kargo satırı tutarlı olmalı
      await expect(async () => {
        const total = trNumber(await row(page, "Ürünler Toplamı").innerText());
        const ship = (await row(page, "Kargo / Teslimat").innerText()).trim();
        if (total >= threshold) expect(ship, `toplam ${total} >= ${threshold}`).toBe("Ücretsiz");
        else {
          expect(ship, `toplam ${total} < ${threshold}`).not.toBe("Ücretsiz");
          expect(trNumber(ship)).toBeGreaterThan(0);
        }
      }).toPass();
      return trNumber(await row(page, "Ürünler Toplamı").innerText());
    };

    let total = await check();
    // Adedi artırarak eşiğin diğer tarafına geç (en çok 8 tık; stok sınırında durur)
    const plus = page.getByRole("button", { name: "+", exact: true }).first();
    for (let i = 0; i < 8 && total < threshold; i++) {
      await plus.click();
      total = await check();
    }
    test.info().annotations.push({ type: "son-toplam", description: String(total) });

    // Mağazadan teslim: kargo ücretsiz
    await page.getByText("📍 Mağazadan Teslim").click();
    await expect(row(page, "Kargo / Teslimat")).toHaveText("Ücretsiz");
  });

  test("mobilde sepet: adet/kaldır düğmeleri ≥40px, form alanları ≥16px, yatay taşma yok", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "yalnızca mobil");
    await addFirstProduct(page);
    await openOk(page, "/sepet");
    await expect(page.getByText("Ürünler Toplamı")).toBeVisible();
    for (const name of ["+", "-"]) {
      const box = await page.getByRole("button", { name, exact: true }).first().boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(40);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
    }
    const rm = await page.getByTitle("Kaldır").first().boundingBox();
    expect(rm?.width ?? 0).toBeGreaterThanOrEqual(40);
    expect(rm?.height ?? 0).toBeGreaterThanOrEqual(40);
    const small = await page.locator("main input:not([type=checkbox]):not([type=radio]), main textarea, main select").evaluateAll((els) =>
      els.filter((e) => e.getClientRects().length > 0 && parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.getAttribute("aria-label") ?? e.tagName),
    );
    expect(small).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
  test("mobil sepet sırası: ürün → kupon → teslimat yöntemi → Teslimat Bilgileri → not → ödeme → özet; düğme yüzen düğmeleri örtmez", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "yalnızca mobil");
    await addFirstProduct(page);
    await openOk(page, "/sepet");
    await expect(page.getByText("Ürünler Toplamı")).toBeVisible();
    const y = async (loc: ReturnType<Page["locator"]>) => (await loc.first().boundingBox())?.y ?? -1;
    const ys = [
      await y(page.getByTitle("Kaldır")),
      await y(page.getByLabel("Kupon kodu")),
      await y(page.getByText("📍 Mağazadan Teslim")),
      await y(page.getByRole("heading", { name: "Teslimat Bilgileri" })),
      await y(page.getByLabel(/Sipariş Notu|Özel İstekleriniz/)),
      await y(page.getByRole("heading", { name: "Ödeme Bilgileri" })),
      await y(page.getByRole("heading", { name: "Sipariş Özeti" })),
    ];
    expect(ys.every((v) => v >= 0)).toBe(true);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    // Sayfa sonunda gönder düğmesi sağ alttaki yüzen telefon/WhatsApp düğmeleriyle kesişmez
    const submit = page.getByRole("button", { name: /Ödemeye Geç|Siparişi Tamamla/ });
    await submit.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const b = await submit.boundingBox();
    const fabs = await page.locator("a[href^=\"tel:\"], a[href*=\"wa.me\"]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
    for (const f of fabs) {
      const hit = b && b.x < f.right && b.x + b.width > f.left && b.y < f.bottom && b.y + b.height > f.top;
      expect(hit).toBeFalsy();
    }
  });

  test("onaysız durumda pasif nedeni görünür; boş formda tarayıcı doğrulaması (form özniteliği) gönderimi durdurur", async ({ page }) => {
    await addFirstProduct(page);
    await openOk(page, "/sepet");
    await expect(page.getByText("Ürünler Toplamı")).toBeVisible();
    await expect(page.getByTestId("odeme-pasif-neden")).toBeVisible();
    await page.getByRole("checkbox", { name: /Ön Bilgilendirme/ }).check();
    await page.getByRole("checkbox", { name: /Mesafeli Satış/ }).check();
    const submit = page.getByRole("button", { name: /Ödemeye Geç|Siparişi Tamamla/ });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(/\/sepet/);
    expect(await page.getByLabel(/Adınız Soyadınız/).evaluate((e: HTMLInputElement) => e.validity.valueMissing)).toBe(true);
  });
});
