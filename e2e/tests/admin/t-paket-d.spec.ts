import { test, expect } from "../../fixtures";
import { cleanupE2eProducts, createProductViaForm, findInProductList, openAdmin, png, uniq } from "../../admin-helpers";
import { productIdByTitle } from "../../db";

const PREFIX = "E2E Paket D";
const SECTION_IDS = ["kargonomi", "trendyol", "yeni-avize", "indirim", "oturumlar", "guvenlik", "yonetici-sifre", "kategoriler", "ana-sayfa", "kuponlar", "urunler", "siparisler", "mesajlar", "yorumlar", "kurumsal", "musteri-hareketleri"];

test.describe("Admin paket D: görsel düzen ve bölüme git çubuğu", () => {
  test.afterAll(async ({ request }) => {
    await cleanupE2eProducts(request, PREFIX);
  });

  test("çubuk: 16 bölümün hepsine bağlantı var ve hedefler sayfada bulunur", async ({ page }) => {
    await openAdmin(page);
    const nav = page.getByRole("navigation", { name: "Yönetim bölümleri" });
    await expect(nav).toBeVisible();
    const hrefs = await nav.locator("a").evaluateAll((els) => els.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(SECTION_IDS.map((id) => `#${id}`));
    for (const id of SECTION_IDS) await expect(page.locator(`#${id}`), `#${id} bölümü`).toHaveCount(1);
  });

  test("çubuk: kapalı bölüme gidince açılır ve başlık yapışkan çubuk + mağaza menüsünün altında kalmaz; çubuk kaydırınca da yerinde", async ({ page }) => {
    await openAdmin(page);
    const nav = page.getByRole("navigation", { name: "Yönetim bölümleri" });
    for (const [id, label] of [["kuponlar", "Promosyon Kodları"], ["kurumsal", "Kurumsal"]] as const) {
      const header = page.locator(`#${id} button[aria-expanded]`).first();
      expect(await header.getAttribute("aria-expanded"), `${id} başta kapalı`).toBe("false");
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(header).toHaveAttribute("aria-expanded", "true");
      await expect.poll(async () => (await page.locator(`#${id}`).boundingBox())!.y, { timeout: 5000 }).toBeLessThan(250);
      const navBox = (await nav.boundingBox())!;
      const secTop = (await page.locator(`#${id}`).boundingBox())!.y;
      expect(secTop, `${id}: başlık çubuğun altında`).toBeGreaterThanOrEqual(navBox.y + navBox.height - 2);
      const hdr = (await page.locator("body > header").first().boundingBox())!;
      expect(navBox.y, "çubuk mağaza menüsünün altında").toBeGreaterThanOrEqual(hdr.y + hdr.height - 2);
    }
    await expect(nav).toBeInViewport(); // kaydırıldıktan sonra da görünür (yapışkan)
  });

  test("tüm bölüm başlıkları tek boyutta (18 px) ve h2", async ({ page }) => {
    await openAdmin(page);
    const sizes = await page.evaluate((ids) => ids.map((id) => {
      const h = document.querySelector(`#${id} h2`);
      return { id, size: h ? getComputedStyle(h).fontSize : "yok" };
    }), SECTION_IDS);
    expect(sizes.filter((s) => s.size !== "18px"), "18 px olmayan başlıklar").toEqual([]);
  });

  test("katalog satırı: stok yazısı 11 px; varyasyon kutusu başlık uzunluğundan bağımsız hizalı; küçük resim yer tutucusu", async ({ page }) => {
    const short = `${PREFIX} ${uniq()}`;
    const long = `${PREFIX} ${uniq()} çok uzun bir avize adı örneği altın kristal sarkıt çok kollu klasik model`;
    page.on("dialog", (d) => void d.accept());
    await openAdmin(page);
    for (const title of [short, long]) {
      await createProductViaForm(page, { title, category: "Kristal", price: "999", photos: [png(10, 120, 200)], colors: [{ name: "E2E Renk", stock: "7" }] });
      await expect.poll(async () => (await productIdByTitle(title)) ?? "", { timeout: 30_000 }).not.toBe("");
    }
    const [idA, idB] = [(await productIdByTitle(short))!, (await productIdByTitle(long))!];
    await openAdmin(page);
    await findInProductList(page, PREFIX);
    const box = (id: string) => page.locator(`#ap-${id}`).locator("div.bg-white.border", { has: page.getByText("E2E Renk", { exact: true }) }).first();
    await expect(box(idA)).toBeVisible();
    await expect(box(idB)).toBeVisible();
    const [a, b] = [(await box(idA).boundingBox())!, (await box(idB).boundingBox())!];
    expect(Math.abs(a.x - b.x), "varyasyon kutusu yatay konumu").toBeLessThanOrEqual(1);
    expect(Math.round(a.width)).toBe(Math.round(b.width));
    const stockFont = await page.locator(`#ap-${idA}`).getByText(/^Stok:/).first().evaluate((el) => getComputedStyle(el).fontSize);
    expect(stockFont).toBe("11px");
    const thumb = page.locator(`#ap-${idA} a[aria-label$="yeni sekmede aç"]`).first();
    expect(await thumb.getAttribute("class")).toMatch(/bg-neutral-200/);
  });

  test("mobil genişlik (390): yatay taşma yok, çubuk yatay kaydırılabilir", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAdmin(page);
    const nav = page.getByRole("navigation", { name: "Yönetim bölümleri" });
    await expect(nav).toBeVisible();
    const m = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth, list: (() => { const u = document.querySelector('nav[aria-label="Yönetim bölümleri"] ul') as HTMLElement; return { sw: u.scrollWidth, cw: u.clientWidth }; })() }));
    expect(m.doc, "sayfa yatay taşması").toBeLessThanOrEqual(m.win);
    expect(m.list.sw, "çubuk içeriği dar ekrandan geniş (kaydırılır)").toBeGreaterThan(m.list.cw);
    await nav.getByRole("link", { name: "Kurumsal", exact: true }).click();
    await expect(page.locator("#kurumsal button[aria-expanded]").first()).toHaveAttribute("aria-expanded", "true");
  });

  // Elle görsel inceleme için: SHOTS=<klasör> verilirse çubuk ve satır görüntülerini alır (verilmezse atlanır)
  test("görsel inceleme ekran görüntüleri (isteğe bağlı)", async ({ page }) => {
    const dir = process.env.SHOTS;
    test.skip(!dir, "SHOTS tanımlı değil");
    await openAdmin(page);
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.screenshot({ path: `${dir}/d-admin-1280.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.screenshot({ path: `${dir}/d-admin-390.png` });
  });
});
