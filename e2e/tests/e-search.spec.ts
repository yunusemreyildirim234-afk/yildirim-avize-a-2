import { test, expect, openOk } from "../fixtures";

async function count(request: import("@playwright/test").APIRequestContext, q: string): Promise<{ n: number; ids: string[] }> {
  const res = await request.get(`/api/search?q=${encodeURIComponent(q)}`);
  expect(res.status(), `arama "${q}"`).toBe(200);
  const body = (await res.json()) as { products: { id: string }[] };
  return { n: body.products.length, ids: body.products.map((p) => p.id).sort() };
}

type P = import("@playwright/test").Page;
const topInput = (page: P) => page.getByLabel("Ürün adı, model kodu veya stok kodu ile ara").and(page.locator(":visible"));

/** Üst aramaya yazar. Hidrasyondan önceki tıklama/yazma kaybolabilir (mobil katman açılmaz, değer sıfırlanır): görünür ve değer tutana kadar yeniden dener. */
async function typeTop(page: P, mobile: boolean, text: string) {
  await expect(async () => {
    if (mobile && !(await topInput(page).count())) await page.getByRole("button", { name: "Ürün ara" }).first().click();
    await topInput(page).fill(text, { timeout: 3000 });
    await expect(topInput(page)).toHaveValue(text, { timeout: 2000 });
  }).toPass({ timeout: 25_000 });
  return topInput(page);
}

test.describe("e) Arama (salt okunur)", () => {
  test('"avize" ve "AVİZE" aynı sonuç sayısını verir', async ({ request }) => {
    const a = await count(request, "avize");
    const b = await count(request, "AVİZE");
    expect(b.n, 'büyük harf/İ ile aranan sonuç sayısı küçük harfliyle aynı olmalı').toBe(a.n);
    expect(b.ids).toEqual(a.ids);
  });

  test('"Kontes" ve "KONTES" aynı sonuç sayısını verir', async ({ request }) => {
    const a = await count(request, "Kontes");
    const b = await count(request, "KONTES");
    expect(b.n).toBe(a.n);
    expect(b.ids).toEqual(a.ids);
  });

  test("dört yazım biçimi birlikte tutarlı", async ({ request }) => {
    const sizes = await Promise.all(["avize", "AVİZE", "Kontes", "KONTES"].map((q) => count(request, q).then((r) => r.n)));
    test.info().annotations.push({ type: "sonuc-sayilari", description: `avize=${sizes[0]} AVİZE=${sizes[1]} Kontes=${sizes[2]} KONTES=${sizes[3]}` });
    expect(sizes[0]).toBe(sizes[1]);
    expect(sizes[2]).toBe(sizes[3]);
  });

  test("arama kutusu sonuç listesini gösterir", async ({ page }, info) => {
    await openOk(page, "/");
    // Odaklanınca mobil katman da DOM'a eklenir (masaüstünde gizli ikinci kutu): yalnızca görünür olanı seç.
    const list = page.getByRole("listbox", { name: "Arama sonuçları" });
    const none = page.getByText(/bulunamadı|sonuç yok/i);
    await typeTop(page, info.project.name === "mobile", "avize");
    await expect(list.or(none).first()).toBeVisible();
  });

  // ---- /arama sayfası (üst aramada Enter) ----
  const productHrefs = async (page: import("@playwright/test").Page) =>
    [...new Set(await page.locator("main a[href^='/urun/']").evaluateAll((els) => els.map((e) => e.getAttribute("href") as string)))];
  const resultCount = async (page: import("@playwright/test").Page) => Number((await page.locator("main section").first().innerText()).match(/(\d+) sonuç/)?.[1] ?? NaN);

  test("Enter ilk ürüne değil /arama?q= sayfasına gider; sayı ve kartlar tutarlı", async ({ page }, info) => {
    await openOk(page, "/");
    const input = await typeTop(page, info.project.name === "mobile", "avize");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/arama\?q=avize$/);
    await expect(page.getByRole("heading", { level: 1, name: "Arama Sonuçları" })).toBeVisible();
    const n = await resultCount(page);
    expect(n).toBeGreaterThan(0);
    const hrefs = await productHrefs(page);
    expect(hrefs.length).toBe(Math.min(n, 24));
  });

  test("/api/search sonuçları /arama sayfasında da vardır (ortak koşul)", async ({ page, request }) => {
    const api = await count(request, "Kontes");
    await openOk(page, "/arama?q=Kontes&adet=96");
    const n = await resultCount(page);
    test.skip(n > 96, "sonuç sayısı tek sayfaya sığmıyor");
    const hrefs = await productHrefs(page);
    for (const id of api.ids) expect(hrefs, `API ürünü ${id}`).toContain(`/urun/${id}`);
    expect(n).toBeGreaterThanOrEqual(api.n);
  });

  test("Türkçe büyük/küçük harf: AVİZE = avize", async ({ page }) => {
    await openOk(page, "/arama?q=avize");
    const a = await resultCount(page);
    await openOk(page, `/arama?q=${encodeURIComponent("AVİZE")}`);
    expect(await resultCount(page)).toBe(a);
  });

  test("sonuç yok ve boş sorgu durumları", async ({ page }) => {
    await openOk(page, "/arama?q=zzqxjw9");
    await expect(page.getByRole("heading", { name: "Aradığınız ürün bulunamadı" })).toBeVisible();
    await expect(page.locator("main a[href^='/kategori/']").first()).toBeVisible();
    await expect(page.getByRole("searchbox", { name: /ara/i }).last()).toBeVisible();
    await openOk(page, "/arama");
    await expect(page.getByRole("heading", { name: "Aramak için bir ifade yazın" })).toBeVisible();
  });

  test("noindex, canonical yok, sitemap'te yok; kaçış güvenli; yatay taşma yok", async ({ page, request }) => {
    let dialog = false;
    page.on("dialog", (d) => { dialog = true; void d.dismiss(); });
    await openOk(page, `/arama?q=${encodeURIComponent("<script>alert(1)</script>")}`);
    expect(await page.locator("meta[name='robots']").getAttribute("content")).toMatch(/noindex/);
    await expect(page.locator("link[rel='canonical']")).toHaveCount(0);
    await expect(page.locator("main").getByText("<script>alert(1)</script>").first()).toBeVisible();
    expect(dialog).toBe(false);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "yatay taşma").toBeLessThanOrEqual(0);
    const map = await (await request.get("/sitemap.xml")).text();
    expect(map).not.toContain("/arama");
  });

  test("öneriye tıklamak ürüne gider", async ({ page }, info) => {
    await openOk(page, "/");
    await typeTop(page, info.project.name === "mobile", "avize");
    const first = page.getByRole("listbox", { name: "Arama sonuçları" }).getByRole("link").first();
    await first.click();
    await expect(page).toHaveURL(/\/urun\//);
  });

  // ---- Ana sayfadaki büyük arama kutusu (SearchBar): üst aramayla aynı davranış ----
  test("ana sayfa arama kutusu: Enter ve büyüteç /arama?q= sayfasına gider", async ({ page }) => {
    await openOk(page, "/");
    const box = page.getByLabel("Avize ara");
    await expect(async () => {
      await box.fill("avize", { timeout: 3000 });
      await expect(box).toHaveValue("avize", { timeout: 2000 });
    }).toPass({ timeout: 20_000 });
    await box.press("Enter");
    await expect(page).toHaveURL(/\/arama\?q=avize$/);
    await expect(page.getByRole("heading", { level: 1, name: "Arama Sonuçları" })).toBeVisible();
    await openOk(page, "/");
    await expect(async () => {
      await page.getByLabel("Avize ara").fill("kontes", { timeout: 3000 });
      await expect(page.getByLabel("Avize ara")).toHaveValue("kontes", { timeout: 2000 });
    }).toPass({ timeout: 20_000 });
    await page.locator("form[role=search]", { has: page.getByLabel("Avize ara") }).getByRole("button", { name: "Ara", exact: true }).click();
    await expect(page).toHaveURL(/\/arama\?q=kontes$/);
  });

  test("ana sayfa arama kutusu: öneriye tıklamak ürüne gider", async ({ page }) => {
    await openOk(page, "/");
    await expect(async () => {
      await page.getByLabel("Avize ara").fill("avize", { timeout: 3000 });
      await expect(page.getByLabel("Avize ara")).toHaveValue("avize", { timeout: 2000 });
    }).toPass({ timeout: 20_000 });
    const suggestion = page.locator("div.absolute a[href^='/urun/']").first();
    await expect(suggestion).toBeVisible();
    await suggestion.click();
    await expect(page).toHaveURL(/\/urun\//);
  });
});
