import type { Page } from "@playwright/test";
import { test, expect, openOk, productLinks, trNumber, lockNetwork } from "../fixtures";

// Ortak sıralama + filtre sistemi (/kategori/[slug] ve /arama): salt okunur, e2e veritabanındaki gerçek ürünlerle.
const ALL = "/kategori/tum?adet=tumu";
const robotsOf = (page: Page) => page.evaluate(() => document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "");
const count = async (page: Page) => Number(await page.getByTestId("urun-sayisi").locator("strong").innerText());
const hrefs = (page: Page) => productLinks(page).evaluateAll((els) => els.map((a) => a.getAttribute("href") ?? "").filter((h, i, arr) => arr.indexOf(h) === i));
// Kartın ana fiyatı: kart bağlantısındaki ilk kalın fiyat
const prices = (page: Page) =>
  page.locator("main div.group > a[href^='/urun/']").evaluateAll((els) => els.map((a) => (a.querySelector("span.font-bold.tabular-nums")?.textContent ?? "").trim()));

/** Filtre panelini kullanılabilir yapar: mobilde çekmeceyi açar. */
async function openPanel(page: Page, mobile: boolean) {
  if (mobile) {
    await page.getByTestId("filtre-ac").click();
    await expect(page.getByRole("dialog", { name: "Filtrele ve Sırala" })).toBeVisible();
  }
  return page.locator("#filtre-paneli form");
}

test.describe("m) Ortak sıralama ve filtre", () => {
  test("fiyata göre sıralama kartlardaki fiyatla tutarlı: monoton, tekrarsız, kararlı", async ({ page }) => {
    await openOk(page, ALL);
    const base = await hrefs(page);
    test.skip(base.length < 3, "yeterli ürün yok");
    for (const [sort, dir] of [["fiyat-artan", 1], ["fiyat-azalan", -1]] as const) {
      await openOk(page, `${ALL}&siralama=${sort}`);
      const list = await hrefs(page);
      expect(list.length).toBe(base.length);
      expect(new Set(list).size).toBe(list.length);
      expect([...list].sort()).toEqual([...base].sort());
      const p = (await prices(page)).map(trNumber);
      expect(p.length).toBe(list.length);
      for (let i = 1; i < p.length; i++) expect((p[i] - p[i - 1]) * dir, `${sort}: ${p[i - 1]} → ${p[i]}`).toBeGreaterThanOrEqual(0);
      await openOk(page, `${ALL}&siralama=${sort}`);
      expect(await hrefs(page)).toEqual(list); // aynı istek aynı sıra
    }
  });

  test("diğer sıralamalar aynı ürün kümesini tekrarsız döndürür", async ({ page }) => {
    await openOk(page, ALL);
    const base = await hrefs(page);
    test.skip(base.length < 2, "yeterli ürün yok");
    for (const sort of ["cok-satan", "one-cikan", "en-yeni"]) {
      await openOk(page, `${ALL}&siralama=${sort}`);
      const list = await hrefs(page);
      expect(new Set(list).size, sort).toBe(list.length);
      expect([...list].sort(), sort).toEqual([...base].sort());
    }
  });

  test("kategori ve fiyat filtresi: sayılar tutarlı, kartlar filtreye uyar", async ({ page }, info) => {
    const mobile = info.project.name === "mobile";
    await openOk(page, ALL);
    const total = await count(page);
    const form = await openPanel(page, mobile);
    const boxes = form.locator('input[name="kategori"]');
    test.skip((await boxes.count()) < 2, "birden çok kategori yok");
    const first = boxes.first();
    const slug = (await first.getAttribute("value"))!;
    const shown = Number(((await first.locator("xpath=ancestor::label").innerText()).match(/\((\d+)\)/) ?? [])[1]);
    await openOk(page, `${ALL}&kategori=${slug}`);
    expect(await count(page)).toBe(shown);
    expect(shown).toBeLessThan(total);
    const cats = await page.locator("main div.group > a[href^='/urun/'] span.uppercase").allInnerTexts();
    expect(new Set(cats.map((c) => c.trim().toLocaleLowerCase("tr-TR"))).size).toBe(1);
    // fiyat aralığı
    const ps = (await prices(page)).map(trNumber).sort((a, b) => a - b);
    const mid = ps[Math.floor(ps.length / 2)];
    await openOk(page, `${ALL}&kategori=${slug}&fiyat_min=${Math.floor(mid)}`);
    const inRange = (await prices(page)).map(trNumber);
    expect(inRange.length).toBeGreaterThan(0);
    for (const v of inRange) expect(v).toBeGreaterThanOrEqual(Math.floor(mid));
    // seçili çip ve temizleme
    await expect(page.getByRole("group", { name: "Seçili filtreler" })).toBeVisible();
    await page.getByRole("link", { name: "Filtreleri temizle" }).first().click();
    await expect(page).not.toHaveURL(/kategori=/);
  });

  test("renk filtresi: veri varsa sayı ve sonuçlar tutarlı; yoksa atlanır", async ({ page }, info) => {
    const mobile = info.project.name === "mobile";
    await openOk(page, ALL);
    const form = await openPanel(page, mobile);
    const boxes = form.locator('input[name="renk"]');
    const n = await boxes.count();
    info.annotations.push({ type: "renk-secenekleri", description: String(n) });
    test.skip(n === 0, "e2e veritabanında 'Renk' türünde varyasyon yok");
    const first = boxes.first();
    const key = (await first.getAttribute("value"))!;
    const shown = Number(((await first.locator("xpath=ancestor::label").innerText()).match(/\((\d+)\)/) ?? [])[1]);
    await openOk(page, `${ALL}&renk=${key}`);
    expect(await count(page)).toBe(shown);
  });

  test("filtre + sıralama + adet + sayfalama birlikte; sıralama değişince sayfa 1'e döner (JS)", async ({ page }, info) => {
    const mobile = info.project.name === "mobile";
    await openOk(page, "/kategori/tum?adet=24");
    const total = await count(page);
    test.skip(total <= 24, "ikinci sayfa için yeterli ürün yok");
    await openOk(page, "/kategori/tum?sayfa=2&siralama=fiyat-artan");
    await expect(page.getByTestId("urun-sayisi")).toContainText("25-");
    if (mobile) {
      await openPanel(page, true);
      await page.locator("#siralama-panel").selectOption("fiyat-azalan");
      await page.locator("#filtre-paneli").getByRole("button", { name: /^Uygula/ }).click();
    } else {
      await page.getByLabel("Sırala:").selectOption("fiyat-azalan");
    }
    await expect(page).toHaveURL(/siralama=fiyat-azalan/);
    expect(page.url()).not.toContain("sayfa=");
    await expect(page.getByTestId("urun-sayisi")).toContainText("1-24");
    // yenileme durumu korur; geri düğmesi önceki adrese döner
    await page.reload();
    await expect(page).toHaveURL(/siralama=fiyat-azalan/);
    const p = (await prices(page)).map(trNumber);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeLessThanOrEqual(p[i - 1]);
    await page.goBack();
    await expect(page).toHaveURL(/sayfa=2/);
  });

  test("SEO: filtreli/sıralı adres noindex + filtresiz canonical; ana kategori sayfası değişmez", async ({ page }) => {
    await openOk(page, "/kategori/tum");
    expect(await robotsOf(page)).not.toContain("noindex");
    const plainCanonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(plainCanonical).toMatch(/\/kategori\/tum$/);
    for (const q of ["siralama=fiyat-artan", "fiyat_min=100", "kategori=modern", "renk=gold"]) {
      await openOk(page, `/kategori/tum?${q}`);
      const robots = await robotsOf(page);
      // Tanınmayan kategori/renk değeri varsayılana düşer: o durumda dizine alınabilir kalır
      if (q.startsWith("kategori") || q.startsWith("renk")) continue;
      expect(robots, q).toContain("noindex");
      expect(robots, q).toContain("follow");
      expect(await page.locator('link[rel="canonical"]').getAttribute("href"), q).toBe(plainCanonical);
    }
    // geçersiz değerler varsayılana düşer: dizine alınabilir kalır
    await openOk(page, "/kategori/tum?siralama=zzz");
    expect(await robotsOf(page)).not.toContain("noindex");
  });

  test("geçersiz ve zararlı parametreler sessizce varsayılana düşer", async ({ page, consoleErrors, serverErrors }) => {
    const bad = `siralama=%3Cscript%3Ealert(1)%3C%2Fscript%3E&kategori=%27%22%3E%3Cimg%20src%3Dx%3E,../x&renk=${"a".repeat(500)}&fiyat_min=abc&fiyat_max=-5&adet=zz&sayfa=-1`;
    for (const path of ["/kategori/tum?", "/arama?q=avize&"]) {
      await openOk(page, `${path}${bad}`);
      await expect(page.locator("main")).toBeVisible();
      expect(await page.locator("main img[src='x']").count()).toBe(0);
    }
    expect(serverErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("boş sonuç: 'Filtrelere uyan ürün bulunamadı' ve temizleme bağlantısı", async ({ page }) => {
    await openOk(page, "/kategori/tum?fiyat_min=9999999");
    await expect(page.getByTestId("liste-bos")).toContainText("Filtrelere uyan ürün bulunamadı");
    expect(await count(page)).toBe(0);
    await page.getByTestId("liste-bos").getByRole("link", { name: "Filtreleri temizle" }).click();
    await expect(page).not.toHaveURL(/fiyat_min/);
    expect(await count(page)).toBeGreaterThan(0);
  });

  test("masaüstü: panel solda, ızgara 3 sütun; mobil: çekmece aç/kapat/uygula, yatay taşma yok, dokunma hedefleri", async ({ page }, info) => {
    const mobile = info.project.name === "mobile";
    await openOk(page, "/kategori/tum");
    test.skip((await productLinks(page).count()) < 3, "yeterli ürün yok");
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    if (!mobile) {
      const panel = page.locator("#filtre-paneli");
      await expect(panel).toBeVisible();
      const box = (await panel.boundingBox())!;
      expect(box.x).toBeLessThan(400);
      const xs = await page.locator("main div.group").evaluateAll((els) => els.slice(0, 6).map((e) => Math.round(e.getBoundingClientRect().left)));
      expect(new Set(xs).size).toBe(3);
      return;
    }
    const opener = page.getByTestId("filtre-ac");
    expect((await opener.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator("#filtre-paneli")).toBeHidden();
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Filtrele ve Sırala" });
    await expect(dialog).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.click();
    await dialog.getByRole("button", { name: "Kapat" }).click();
    await expect(dialog).toBeHidden();
    await opener.click();
    await page.locator("#siralama-panel").selectOption("fiyat-artan");
    await page.locator("#filtre-paneli").getByRole("button", { name: /^Uygula/ }).click();
    await expect(page).toHaveURL(/siralama=fiyat-artan/);
    await expect(dialog).toBeHidden();
    expect(await overflow()).toBeLessThanOrEqual(0);
  });

  test("kart davranışı bozulmadı: kalp/+ düğmeleri filtreli listede var, kart bağlantısı ürüne gider", async ({ page }) => {
    await openOk(page, `${ALL}&siralama=fiyat-artan`);
    test.skip((await productLinks(page).count()) === 0, "ürün yok");
    const card = page.locator("main div.group").first();
    await expect(card.getByRole("button", { name: /Favorilere ekle|Favorilerden/ }).first()).toBeVisible();
    await expect(card.getByRole("button", { name: /Sepete Ekle|Adedi artır|Seçenek/ }).first()).toBeVisible();
    await card.locator("a[href^='/urun/']").first().click();
    await expect(page).toHaveURL(/\/urun\//);
  });

  test("/arama: aynı sıralama ve filtre bileşenleri", async ({ page }) => {
    await openOk(page, "/arama?q=avize&adet=tumu&siralama=fiyat-artan");
    test.skip((await productLinks(page).count()) < 2, "arama sonucu yok");
    await expect(page.locator("#filtre-paneli")).toHaveCount(1);
    const p = (await prices(page)).map(trNumber);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThanOrEqual(p[i - 1]);
    expect(await robotsOf(page)).toContain("noindex");
    await expect(page.locator('#filtre-paneli input[type="hidden"][name="q"]')).toHaveAttribute("value", "avize");
  });

  test("JS kapalıyken sunucu tarafı çalışır: sıralı liste ve GET formu", async ({ browser, baseURL }, info) => {
    test.skip(info.project.name === "mobile", "masaüstü paneli");
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
    await lockNetwork(context, baseURL!);
    const page = await context.newPage();
    try {
      await openOk(page, `${ALL}&siralama=fiyat-artan`);
      const p = (await prices(page)).map(trNumber);
      test.skip(p.length < 3, "ürün yok");
      for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThanOrEqual(p[i - 1]);
      const form = page.locator("#filtre-paneli form");
      await expect(form).toHaveAttribute("method", "get");
      const box = form.locator('input[name="kategori"]').first();
      if ((await box.count()) > 0) {
        await box.check();
        await form.getByRole("button", { name: /^Uygula/ }).click();
        await expect(page).toHaveURL(/kategori=/);
      }
    } finally {
      await context.close();
    }
  });
});
