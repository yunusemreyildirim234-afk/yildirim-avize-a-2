import { test, expect, openOk, menuLinks, productLinks } from "../fixtures";

const FIXED_ORDER = ["kristal", "modern", "klasik", "sarkit", "aksesuar"]; // sabit kategorilerin sırası ve adresleri
const slugOf = (href: string) => href.replace(/^\/kategori\//, "");

test.describe("b) Menü ve kategoriler", () => {
  test("'Tüm Ürünler' ilk, sabit kategoriler aynı sırada ve adreslerinde, eklenenler arkasında", async ({ page }) => {
    await openOk(page, "/");
    const slugs = (await menuLinks(page)).map((l) => slugOf(l.href));
    expect(slugs[0]).toBe("tum");
    const fixedShown = slugs.filter((s) => FIXED_ORDER.includes(s));
    // Görünür ürünü olmayan sabit kategori menüden çıkar; kalanlar sabit sırayı korur
    expect(fixedShown).toEqual(FIXED_ORDER.filter((s) => fixedShown.includes(s)));
    const lastFixed = Math.max(...fixedShown.map((s) => slugs.indexOf(s)), 0);
    const extras = slugs.slice(1).filter((s) => !FIXED_ORDER.includes(s));
    for (const e of extras) expect(slugs.indexOf(e), `${e} sabitlerden sonra gelmeli`).toBeGreaterThan(lastFixed);
    expect(new Set(slugs).size, "menüde tekrar eden adres olmamalı").toBe(slugs.length);
  });

  test("menüdeki her kategori en az bir ürün kartı gösterir; menüde olmayan sabit kategori ürünsüzdür", async ({ page }) => {
    await openOk(page, "/");
    const slugs = (await menuLinks(page)).map((l) => slugOf(l.href)).filter((s) => s !== "tum");
    for (const s of slugs) {
      await test.step(`/kategori/${s}: kart var`, async () => {
        await openOk(page, `/kategori/${s}`);
        await expect(productLinks(page).first(), `${s} kategorisinde kart yok`).toBeVisible();
      });
    }
    for (const s of FIXED_ORDER.filter((f) => !slugs.includes(f))) {
      await test.step(`/kategori/${s}: menüde yok → ürünsüz, adres çalışır`, async () => {
        await openOk(page, `/kategori/${s}`); // adres çalışmaya devam eder
        await expect(page.getByText("Bu listede henüz ürün yok")).toBeVisible();
        expect(await productLinks(page).count()).toBe(0);
      });
    }
  });

  test("ana sayfa kategori satırı: kartlar menüdeki kategorilerle uyumlu, ok düğmeleri yalnızca 4+ kartta", async ({ page }, info) => {
    await openOk(page, "/");
    const row = page.locator('section:has(h2:has-text("Aydınlatma Koleksiyonları")) [role="list"]');
    await expect(row).toBeVisible();
    const cards = row.locator('a[href^="/kategori/"]');
    const n = await cards.count();
    expect(n).toBeGreaterThan(0);
    const menu = new Set((await menuLinks(page)).map((l) => slugOf(l.href)));
    for (const href of await cards.evaluateAll((els) => els.map((a) => a.getAttribute("href") ?? ""))) expect(menu.has(slugOf(href)), `${href} menüde yok`).toBe(true);

    const prev = page.getByRole("button", { name: "Önceki koleksiyonlar" });
    const nextBtn = page.getByRole("button", { name: "Sonraki koleksiyonlar" });
    if (n <= 4) {
      await expect(prev).toHaveCount(0);
      await expect(nextBtn).toHaveCount(0);
    } else if (info.project.name === "desktop") {
      await expect(nextBtn).toBeVisible();
      await expect(prev).toBeVisible();
      const before = await row.evaluate((el) => el.scrollLeft);
      await nextBtn.click();
      await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before);
    } else {
      // Mobilde ok yok (gizli); parmakla yatay kaydırma mümkün
      await expect(nextBtn).toBeHidden();
      expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    }
  });

  test("mobil üst şerit yatay kaydırılır", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "yalnızca mobil");
    await openOk(page, "/");
    const strip = page.locator('nav[aria-label="Koleksiyonlar"]');
    await expect(strip).toBeVisible();
    expect(await strip.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
    const scrollable = await strip.evaluate((el) => el.scrollWidth > el.clientWidth);
    test.skip(!scrollable, "şerit ekrana sığıyor (az kategori)");
    await strip.evaluate((el) => el.scrollTo({ left: 120 }));
    await expect.poll(() => strip.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  });

  test("masaüstü açılır menü sabit sırayı gösterir", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "yalnızca masaüstü");
    await openOk(page, "/");
    await page.getByRole("button", { name: "Koleksiyonlar menüsünü aç" }).hover();
    const items = page.getByRole("menuitem").filter({ hasText: /./ }).locator("xpath=self::a[starts-with(@href,'/kategori/')]");
    await expect(items.first()).toBeVisible();
    const hrefs = await items.evaluateAll((els) => els.map((a) => a.getAttribute("href") ?? ""));
    expect(hrefs[0]).toBe("/kategori/tum");
    expect(hrefs.filter((h) => h.startsWith("/kategori/")).map(slugOf).filter((s) => FIXED_ORDER.includes(s))).toEqual(
      FIXED_ORDER.filter((s) => hrefs.includes(`/kategori/${s}`))
    );
  });
});
