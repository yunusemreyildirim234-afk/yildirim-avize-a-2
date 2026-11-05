import type { Page } from "@playwright/test";
import { test, expect, openOk, menuLinks } from "../fixtures";

/** XML'i tarayıcının ayrıştırıcısıyla doğrular (kurulum gerektirmez). Hata varsa mesajı döner. */
async function parseXml(page: Page, xml: string): Promise<{ error: string | null; items: Record<string, string[]>[]; locs: string[] }> {
  return page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const err = doc.querySelector("parsererror");
    const items = [...doc.getElementsByTagName("item")].map((it) => {
      const o: Record<string, string[]> = {};
      for (const c of Array.from(it.children)) (o[c.tagName] ??= []).push((c.textContent ?? "").trim());
      return o;
    });
    const locs = [...doc.getElementsByTagName("loc")].map((l) => (l.textContent ?? "").trim());
    return { error: err ? (err.textContent ?? "ayrıştırma hatası").slice(0, 200) : null, items, locs };
  }, xml);
}

test.describe("f) SEO", () => {
  test("/sitemap.xml geçerli XML ve kategori adreslerini içerir", async ({ page, request }) => {
    await openOk(page, "/");
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/xml/);
    const { error, locs } = await parseXml(page, await res.text());
    expect(error).toBeNull();
    expect(locs.length).toBeGreaterThan(0);
    for (const l of locs) expect(l, "sitemap adresi mutlak olmalı").toMatch(/^https?:\/\//);
    const paths = new Set(locs.map((l) => new URL(l).pathname));
    expect(paths.has("/kategori/tum")).toBe(true);
    // Menüde görünen her kategori sitemap'te de olmalı
    for (const m of await menuLinks(page)) expect(paths.has(m.href), `${m.href} sitemap'te yok`).toBe(true);
  });

  test("sitemap'te görünür ürünü olmayan (menüde olmayan) sabit kategori yok", async ({ page, request }) => {
    await openOk(page, "/");
    const inMenu = new Set((await menuLinks(page)).map((m) => m.href));
    const { locs } = await parseXml(page, await (await request.get("/sitemap.xml")).text());
    const paths = new Set(locs.map((l) => new URL(l).pathname));
    for (const s of ["kristal", "modern", "klasik", "sarkit", "aksesuar"]) {
      expect(paths.has(`/kategori/${s}`), `/kategori/${s}: sitemap ile menü tutarlı olmalı`).toBe(inMenu.has(`/kategori/${s}`));
    }
  });

  test('/robots.txt "Allow: /api/product-images/" içerir', async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain("Allow: /api/product-images/");
    expect(text).toMatch(/Disallow: \/admin/);
    expect(text).toMatch(/Sitemap: https?:\/\//);
  });

  test("/feed/google.xml geçerli XML; her item zorunlu alanları taşır; kupon fiyatı ve boş product_type yok", async ({ page, request }) => {
    await openOk(page, "/");
    const res = await request.get("/feed/google.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/xml/);
    const body = await res.text();
    const { error, items } = await parseXml(page, body);
    expect(error).toBeNull();
    test.info().annotations.push({ type: "feed-item-sayisi", description: String(items.length) });
    test.skip(items.length === 0, "feed'de ürün yok");
    for (const it of items) {
      const id = it["g:id"]?.[0];
      const where = `item ${id}`;
      for (const f of ["g:id", "title", "link", "g:price", "g:availability", "g:image_link"]) expect(it[f]?.[0], `${where}: ${f} eksik`).toBeTruthy();
      expect(it["g:image_link"][0], `${where}: image_link mutlak https olmalı`).toMatch(/^https:\/\//);
      expect(it["link"][0], `${where}: link`).toMatch(/^https?:\/\//);
      expect(it["g:price"][0], `${where}: fiyat biçimi`).toMatch(/^\d+(\.\d{2})? TRY$/);
      expect(["in_stock", "out_of_stock"]).toContain(it["g:availability"][0]);
      if (it["g:product_type"]) expect(it["g:product_type"][0], `${where}: boş product_type yazılmamalı`).not.toBe("");
      if (it["g:sale_price"]) expect(parseFloat(it["g:sale_price"][0]), `${where}: sale_price < price`).toBeLessThan(parseFloat(it["g:price"][0]));
    }
    // Kupon fiyatı feed'e girmez
    expect(body).not.toMatch(/kupon|coupon/i);
    expect(body).not.toContain("<g:product_type></g:product_type>");
  });
});
