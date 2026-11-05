import type { Page } from "@playwright/test";
import { test, expect, openOk, productLinks } from "../fixtures";

/** Sayfadaki başlık seviyeleri (h1-h6) belge sırasıyla. */
const headingLevels = (page: Page) => page.evaluate(() => [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => Number(h.tagName[1])));
/** Başlık sırasında bir seviyeden fazla atlayan geçişler (ör. 2 → 4). */
const skips = (levels: number[]) => levels.filter((l, i) => i > 0 && l - levels[i - 1] > 1).length;

test.describe("k) Vitrin küçük düzeltmeleri (paket A)", () => {
  test("'İçeriğe atla': ilk Tab ile odaklanır, görünür olur, Enter ana içeriğe götürür", async ({ page }) => {
    for (const path of ["/", "/kategori/tum"]) {
      await openOk(page, path);
      await page.waitForLoadState("networkidle");
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "İçeriğe atla" });
      await expect(skip, `${path}: ilk odaklanılan öğe atla bağlantısı olmalı`).toBeFocused();
      await expect(skip).toBeVisible();
      const box = await skip.boundingBox();
      expect(box!.width).toBeGreaterThan(40);
      await page.keyboard.press("Enter");
      await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe("MAIN");
    }
  });

  test("'İçeriğe atla' yalnızca odaklanınca görünür (odak yokken ekranda yer kaplamaz)", async ({ page }) => {
    await openOk(page, "/iletisim");
    const skip = page.getByRole("link", { name: "İçeriğe atla" });
    const box = await skip.boundingBox();
    expect(box === null || box.width <= 1 || box.height <= 1, "odak yokken 1px kutu olmalı").toBe(true);
  });

  test("/iletisim: Konu Başlığı ve tüm form alanları etiketli; başlık sırası atlamıyor", async ({ page }) => {
    await openOk(page, "/iletisim");
    const select = page.getByLabel("Konu Başlığı");
    await expect(select).toHaveCount(1);
    expect(await select.evaluate((el) => el.tagName)).toBe("SELECT");
    for (const name of [/Adınız Soyadınız/, /E-posta Adresiniz/, /Telefon Numaranız/, /Mesajınız veya Proje Detayları/]) {
      await expect(page.getByLabel(name)).toHaveCount(1);
    }
    expect(skips(await headingLevels(page))).toBe(0);
  });

  test("/kategori/tum: başlık sırası atlamıyor (h1 → h2 → h3)", async ({ page }) => {
    await openOk(page, "/kategori/tum");
    const levels = await headingLevels(page);
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    expect(skips(levels)).toBe(0);
  });

  test("/kargo-takip: sunucu çıktısında tek <main>, anlamlı h1; 'Sayfa yükleniyor…' yok", async ({ request }) => {
    const html = await (await request.get("/kargo-takip")).text();
    expect(html.match(/<main[\s>]/g) ?? []).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Kargo &amp; Sipariş Takibi<\/h1>/);
    expect(html).not.toContain("Sayfa yükleniyor");
  });

  test("/kargo-takip: kod verilince sonuç alanı çalışır (bulunamadı iletisi)", async ({ page }) => {
    await openOk(page, "/kargo-takip?code=E2E-OLMAYAN-KOD");
    await expect(page.locator("main").getByText("Bu kodla eşleşen bir sipariş bulunamadı.")).toBeVisible();
    expect(await page.locator("main").count()).toBe(1);
  });

  test("/sepet: sunucu çıktısında h1 var", async ({ request }) => {
    const html = await (await request.get("/sepet")).text();
    expect(html).toMatch(/<h1[^>]*>/);
  });

  test("ürün sayfası: og:type product, twitter alanları ürüne bağlı, og:description satır sonsuz", async ({ page }) => {
    await openOk(page, "/kategori/tum");
    const href = (await productLinks(page).first().getAttribute("href"))!;
    await openOk(page, href);
    const meta = (sel: string) => page.locator(sel).first().getAttribute("content");
    const title = await page.evaluate(() => document.querySelector("main h1")?.textContent?.trim() ?? "");
    expect(await meta('meta[property="og:type"]')).toBe("product");
    await expect(page.locator('meta[property="og:type"]')).toHaveCount(1);
    expect(await meta('meta[property="og:title"]')).toBe(title);
    expect(await meta('meta[name="twitter:title"]')).toBe(title);
    const ogDesc = (await meta('meta[property="og:description"]'))!;
    expect(ogDesc).not.toMatch(/[\r\n\t]/);
    expect(ogDesc).not.toMatch(/ {2,}/);
    expect(await meta('meta[name="twitter:description"]')).toBe(ogDesc);
  });

  test("404: canonical yok, noindex; tüm koleksiyonlar menüyle aynı sayıda önerilir; arama kutusu var", async ({ page }) => {
    const res = await page.goto("/bu-sayfa-yok-e2e", { waitUntil: "domcontentloaded" });
    expect(res!.status()).toBe(404);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    // Next 404'te kendi noindex etiketini de ekler; yalnızca hiçbirinin indekslemeye izin vermediği denetlenir
    const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.getAttribute("content") ?? ""));
    expect(robots.length).toBeGreaterThan(0);
    expect(robots.every((r) => /noindex/.test(r))).toBe(true);
    await expect(page.getByRole("heading", { level: 1, name: "Bu Işık Söndü" })).toBeVisible();
    const chips = await page.locator("main a[href^='/kategori/']").count();
    const footerCats = await page.locator("footer ul a[href^='/kategori/']").count();
    expect(chips).toBeGreaterThan(0);
    expect(chips, "404 önerileri alt bilgideki koleksiyon listesiyle aynı olmalı").toBe(footerCats);
    await expect(page.locator("main").getByPlaceholder(/ara/i).first()).toBeVisible();
  });

  test("müşteri galerisi: bağlantı, sitemap ve noindex birbiriyle tutarlı (boşsa üçü de gizli)", async ({ page, request }) => {
    const path = "/musterilerimizden-gelenler";
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const inSitemap = sitemap.includes(`${path}</loc>`);
    await openOk(page, path);
    const robots = (await page.locator('meta[name="robots"]').first().getAttribute("content").catch(() => null)) ?? "";
    const empty = await page.getByText("Henüz yayınlanmış müşteri fotoğrafı bulunmuyor").count();
    await openOk(page, "/");
    const inFooter = (await page.locator(`footer a[href="${path}"]`).count()) > 0;
    // Önbellek (60 sn) nedeniyle yalnızca durumlar arası tutarlılık denetlenir
    if (empty > 0) {
      expect(robots).toMatch(/noindex/);
      expect(inSitemap, "boş sayfa sitemap'te olmamalı").toBe(false);
      expect(inFooter, "boş sayfa için alt bilgi bağlantısı olmamalı").toBe(false);
    } else {
      expect(robots).not.toMatch(/noindex/);
      expect(inSitemap).toBe(true);
      expect(inFooter).toBe(true);
    }
  });

  test("mobil: 'Sepeti Boşalt' en az 40 px yüksek dokunma alanı", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "yalnızca mobil");
    await openOk(page, "/kategori/tum");
    const hrefs = (await productLinks(page).evaluateAll((els) => els.map((a) => a.getAttribute("href") ?? ""))).filter((h, i, a) => a.indexOf(h) === i).slice(0, 12);
    let added = false;
    for (const href of hrefs) {
      await openOk(page, href);
      const add = page.getByRole("button", { name: /^Sepete Ekle$/ });
      if ((await add.count()) === 0 || (await add.isDisabled())) continue;
      await add.click();
      added = true;
      break;
    }
    test.skip(!added, "stokta ürün bulunamadı");
    await openOk(page, "/sepet");
    const btn = page.getByRole("button", { name: "Sepeti Boşalt" });
    await expect(btn).toBeVisible();
    expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  });

  // Elle görsel inceleme için: SHOTS=<klasör> verilirse ilgili sayfaların ekran görüntüsünü alır (verilmezse atlanır)
  test("görsel inceleme ekran görüntüleri (isteğe bağlı)", async ({ page }, info) => {
    const dir = process.env.SHOTS;
    test.skip(!dir, "SHOTS tanımlı değil");
    for (const [name, path] of [["404", "/bu-sayfa-yok-e2e"], ["iletisim", "/iletisim"], ["kargo", "/kargo-takip"], ["sepet", "/sepet"], ["kategori", "/kategori/tum"]]) {
      await page.goto(path, { waitUntil: "networkidle" });
      await page.screenshot({ path: `${dir}/${info.project.name}-${name}.png`, fullPage: false });
    }
    await page.goto("/", { waitUntil: "networkidle" });
    await page.keyboard.press("Tab");
    await page.screenshot({ path: `${dir}/${info.project.name}-atla.png` });
  });
});
