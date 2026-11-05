import { test, expect, openOk, menuLinks, productLinks } from "../fixtures";

const LEGAL = ["/gizlilik-politikasi", "/kullanim-sartlari", "/mesafeli-satis-sozlesmesi", "/iptal-iade-cayma", "/aydinlatma-metni", "/cerez-politikasi"];
const STATIC = ["/", "/kategori/tum", "/sepet", "/iletisim", "/kargo-takip", "/musterilerimizden-gelenler", ...LEGAL];

test.describe("a) Duman: herkese açık sayfalar", () => {
  for (const path of STATIC) {
    test(`${path}: 200, 5xx yok, konsolda hata yok`, async ({ page, consoleErrors, serverErrors }) => {
      await openOk(page, path);
      await expect(page.locator("main").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      // Kargonomi anahtarları e2e ortamında boş: il/ilçe uçları 502 döner (beklenen, dış servis kapalı)
      expect(serverErrors.filter((e) => !/\/api\/kargonomi\//.test(e)), "5xx yanıtı").toEqual([]);
      expect(consoleErrors, "tarayıcı konsolu hataları").toEqual([]);
    });
  }

  test("SSS bölümü ana sayfada açılıp kapanıyor", async ({ page, consoleErrors }) => {
    await openOk(page, "/");
    const faq = page.locator("#sss-baslik");
    await expect(faq).toBeVisible();
    const first = page.locator("section", { has: faq }).locator("details").first();
    await first.locator("summary").click();
    await expect(first).toHaveAttribute("open", "");
    expect(consoleErrors).toEqual([]);
  });

  test("menüdeki HER kategori bağlantısı: 200, 5xx yok, konsol temiz", async ({ page, consoleErrors, serverErrors }) => {
    await openOk(page, "/");
    const links = await menuLinks(page);
    expect(links.length, "menüde en az 'Tüm Ürünler' olmalı").toBeGreaterThan(0);
    for (const l of links) {
      await test.step(l.href, async () => {
        await openOk(page, l.href);
        await expect(page.locator("h1")).toBeVisible();
      });
    }
    expect(serverErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("bir ürün sayfası: 200, 5xx yok, konsol temiz", async ({ page, consoleErrors, serverErrors }) => {
    await openOk(page, "/kategori/tum");
    const first = productLinks(page).first();
    test.skip((await productLinks(page).count()) === 0, "e2e veritabanında ürün yok");
    const href = (await first.getAttribute("href"))!;
    await openOk(page, href);
    await expect(page.locator("h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(serverErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("var olmayan adres 404 verir ve sayfa bozulmaz", async ({ page }) => {
    const res = await page.goto("/kategori/bu-kategori-yok-e2e", { waitUntil: "domcontentloaded" });
    expect(res!.status()).toBe(404);
    await expect(page.getByText("Bu Işık Söndü")).toBeVisible();
  });
  test("anonim ziyaretçide konsola 401 hatası düşmez", async ({ page }) => {
    test.fail(true, "BULGU: anonim ziyaretçide /api/favorites ve /api/cart 401 döner; tarayıcı her sayfada konsola hata yazar (siteye dokunulmadı)");
    const errs: string[] = [];
    page.on("console", (m) => { if (m.type() === "error" && /status of 401/.test(m.text())) errs.push(`${m.text()} @ ${m.location().url}`); });
    await openOk(page, "/");
    await page.waitForLoadState("networkidle");
    expect(errs).toEqual([]);
  });
});
