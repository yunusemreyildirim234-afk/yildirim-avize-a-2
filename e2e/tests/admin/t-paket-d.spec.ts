import { test, expect } from "../../fixtures";
import { cleanupE2eProducts, createProductViaForm, findInProductList, openAdmin, png, uniq } from "../../admin-helpers";
import { productIdByTitle } from "../../db";

const PREFIX = "E2E Paket D";
// Çubuk: günlük işler şeritte, diğer bölümler "Tümü" panelinde üç başlık altında (panel bağlantıları kapalıyken de DOM'dadır)
const DAILY_IDS = ["siparisler", "mesajlar", "yorumlar", "urunler", "musteri-hareketleri"];
const PANEL_IDS = ["yeni-avize", "kategoriler", "trendyol", "ana-sayfa", "kuponlar", "indirim", "stok-rozeti", "kurumsal", "kargonomi", "oturumlar", "guvenlik", "yonetici-sifre"];
const SECTION_IDS = ["kargonomi", "trendyol", "yeni-avize", "indirim", "oturumlar", "guvenlik", "yonetici-sifre", "kategoriler", "ana-sayfa", "kuponlar", "urunler", "siparisler", "mesajlar", "yorumlar", "kurumsal", "musteri-hareketleri"];

test.describe("Admin paket D: görsel düzen ve bölüme git çubuğu", () => {
  test.afterAll(async ({ request }) => {
    await cleanupE2eProducts(request, PREFIX);
  });

  test("çubuk: 17 bölümün hepsine bağlantı var (5 günlük iş şeritte, 12 bölüm Tümü panelinde) ve hedefler sayfada bulunur", async ({ page }) => {
    await openAdmin(page);
    const nav = page.getByRole("navigation", { name: "Yönetim bölümleri" });
    await expect(nav).toBeVisible();
    const hrefsOf = (sel: string) => nav.locator(sel).evaluateAll((els) => els.map((a) => a.getAttribute("href")));
    expect(await hrefsOf('[data-testid="gunluk-isler"] a')).toEqual(DAILY_IDS.map((id) => `#${id}`));
    const panel = page.locator("#admin-nav-panel");
    await expect(panel).toBeHidden();
    await nav.getByRole("button", { name: "Tümü" }).click();
    await expect(panel).toBeVisible();
    expect(await hrefsOf("#admin-nav-panel a")).toEqual(PANEL_IDS.map((id) => `#${id}`));
    expect(await panel.locator("h3").allTextContents()).toEqual(["Katalog", "Vitrin ve kampanya", "Ayarlar ve güvenlik"]);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    for (const id of [...DAILY_IDS, ...PANEL_IDS]) await expect(page.locator(`#${id}`), `#${id} bölümü`).toHaveCount(1);
  });

  test("çubuk: kapalı bölüme gidince açılır ve başlık yapışkan çubuk + mağaza menüsünün altında kalmaz; çubuk kaydırınca da yerinde", async ({ page }) => {
    await openAdmin(page);
    const nav = page.getByRole("navigation", { name: "Yönetim bölümleri" });
    for (const [id, label] of [["kuponlar", "Promosyon Kodları"], ["kurumsal", "Kurumsal"]] as const) {
      const header = page.locator(`#${id} button[aria-expanded]`).first();
      expect(await header.getAttribute("aria-expanded"), `${id} başta kapalı`).toBe("false");
      await nav.getByRole("button", { name: "Tümü" }).click();
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page.locator("#admin-nav-panel")).toBeHidden(); // bağlantıya basınca panel kapanır
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
    // Şerit tek satır: panel açılınca da yüksekliği değişmez; panel ekrandan taşmaz
    const h0 = (await nav.boundingBox())!.height;
    expect(h0, "şerit tek satır").toBeLessThanOrEqual(64);
    await nav.getByRole("button", { name: "Tümü" }).click();
    expect((await nav.boundingBox())!.height).toBe(h0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await nav.getByRole("link", { name: "Kurumsal", exact: true }).click();
    await expect(page.locator("#kurumsal button[aria-expanded]").first()).toHaveAttribute("aria-expanded", "true");
  });

  test("mobil (390): ürün işaretlenince 'bölüme git' çipleri örtülmez, toplu işlem şeridi taşmaz, Seçimi temizle çalışır", async ({ page }) => {
    const title = `${PREFIX} ${uniq()} toplu`;
    page.on("dialog", (d) => void d.accept());
    await openAdmin(page);
    await createProductViaForm(page, { title, category: "Kristal", price: "999", photos: [png(10, 120, 200)], colors: [{ name: "E2E Renk", stock: "7" }] });
    await expect.poll(async () => (await productIdByTitle(title)) ?? "", { timeout: 30_000 }).not.toBe("");
    await page.setViewportSize({ width: 390, height: 844 });
    await openAdmin(page);
    await findInProductList(page, title);
    await page.getByRole("checkbox", { name: `${title} seç` }).check();
    const region = page.getByRole("region", { name: "Seçilen ürünler" });
    await expect(region).toBeVisible();
    await region.locator('button[aria-controls="admin-selection-detail"]').click(); // toplu işlem katmanını aç
    const chips = page.locator('nav[aria-label="Yönetim bölümleri"] [data-testid="gunluk-isler"] a');
    // Her çip, kendi merkezinde en üstteki öğedir (başka çubuk örtmez) ve çubuk ekranın içindedir
    const covered = await chips.evaluateAll((els) =>
      els.flatMap((a) => {
        const r = a.getBoundingClientRect();
        if (r.right <= 0 || r.left >= window.innerWidth) return []; // yatay kaydırmayla dışarıdaki çip denetlenmez
        const hit = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1), r.top + r.height / 2);
        return hit && (hit === a || a.contains(hit)) ? [] : [a.textContent ?? ""];
      })
    );
    expect(covered, "örtülen bölüm çipleri").toEqual([]);
    const navBox = (await page.getByRole("navigation", { name: "Yönetim bölümleri" }).boundingBox())!;
    const regBox = (await region.boundingBox())!;
    expect(regBox.y, "seçim çubuğu çip çubuğunun altında").toBeGreaterThanOrEqual(navBox.y + navBox.height - 2);
    const m = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
    expect(m.doc, "sayfa yatay taşması").toBeLessThanOrEqual(m.win);
    // Sekme düğmeleri en az 40 px yüksekliğinde
    for (const name of ["Stok", "İsim", "Renk Ekle", "Koleksiyon", "İndirim", "Vitrin"]) {
      const b = await region.getByRole("button", { name, exact: true }).first().boundingBox().catch(() => null);
      if (b) expect(b.height, `${name} düğmesi`).toBeGreaterThanOrEqual(39.5);
    }
    const shots = process.env.SHOTS; // isteğe bağlı görsel inceleme: 390/1280, açık/koyu
    if (shots) {
      for (const [w, h] of [[390, 844], [1280, 800]] as const) {
        await page.setViewportSize({ width: w, height: h });
        for (const dark of [false, true]) {
          await page.evaluate((d) => document.documentElement.classList.toggle("dark", d), dark);
          await region.scrollIntoViewIfNeeded();
          await page.evaluate(() => window.scrollBy(0, 260)); // çubuk yapışık hâlde görünsün
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${shots}/k2-admin-secim-${w}-${dark ? "koyu" : "acik"}.png` });
        }
      }
      await page.evaluate(() => document.documentElement.classList.remove("dark"));
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await region.getByRole("button", { name: "Seçimi temizle" }).click();
    await expect(region.getByText("Toplu işlem için ürünleri işaretleyin.")).toBeVisible();
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
