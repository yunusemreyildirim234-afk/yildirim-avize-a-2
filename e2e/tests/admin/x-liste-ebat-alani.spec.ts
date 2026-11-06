import { test, expect } from "../../fixtures";
import { autoDialogs, cleanupE2eCategories, cleanupE2eProducts, createProductViaForm, findInProductList, openAdmin, refreshStorefront, uniq } from "../../admin-helpers";
import { exec, productIdByTitle, rows } from "../../db";

const PREFIX = "E2E Ebat Alani";

test.describe("Admin: Product.ebat alanı → ebat filtresi + sıralama (E2E önekli veri, sonda silinir)", () => {
  test.afterAll(async ({ request }) => {
    await cleanupE2eProducts(request, PREFIX);
    await cleanupE2eCategories(request);
  });

  test("ebat girişi, geçersiz ebat reddi, Geri Al, filtre sayısı, iki yönde sıralama, mobilde taşma yok", async ({ page, request }) => {
    const tag = uniq();
    const a = `${PREFIX} A ${tag}`; // 45 × 25 yazılır → "45 x 25"
    const b = `${PREFIX} B ${tag}`; // 9 x 14
    const c = `${PREFIX} C ${tag}`; // ebatsız
    const catName = `E2E Ebat Alani ${tag}`;
    const LIST = `/kategori/${catName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}?adet=tumu`;
    const dialogs = autoDialogs(page);

    const ids: Record<string, string> = {};
    for (const [i, title] of [a, b, c].entries()) {
      await openAdmin(page);
      await createProductViaForm(page, { title, category: "Kristal", price: String(1000 + i) });
      await expect.poll(() => dialogs.filter((d) => d.includes("vitrine eklendi")).length, { timeout: 60_000 }).toBe(i + 1);
      ids[title] = (await productIdByTitle(title))!;
      expect(ids[title], "ürün oluştu").toBeTruthy();
      // Rengi OLMAYAN ürün: yer tutucu değer renk sayılmaz
      await exec(`update "ProductVariation" set "variationValue" = 'Standart' where "productId" = $1`, [ids[title]]);
      await exec(`update "Product" set "category" = $1 where id = $2`, [catName, ids[title]]);
    }
    const ebatOf = async (id: string) => (await rows<{ ebat: string | null }>(`select ebat from "Product" where id = $1`, [id]))[0].ebat;

    const edit = async (title: string, value: string) => {
      await openAdmin(page);
      await findInProductList(page, title);
      await page.locator(`#ap-${ids[title]}`).getByRole("button", { name: /Düzenle/ }).click();
      const box = page.locator(`#ap-${ids[title]}`).getByLabel("Ebat", { exact: true });
      await expect(box).toBeVisible();
      await box.fill(value);
      const before = dialogs.length;
      await page.locator(`#ap-${ids[title]}`).getByRole("button", { name: "Bilgileri ve Fotoğrafları Kaydet" }).click();
      await expect.poll(() => dialogs.length, { timeout: 30_000 }).toBeGreaterThan(before);
      return dialogs[dialogs.length - 1];
    };

    // Geçersiz ebat reddedilir, kayıt yapılmaz
    expect(await edit(a, "E27")).toMatch(/Ebat/);
    expect(await ebatOf(ids[a])).toBeNull();
    expect(await edit(a, "45 x 25 x 10")).toMatch(/Ebat/);
    expect(await ebatOf(ids[a])).toBeNull();

    // Geçerli girişler normalize edilir
    expect(await edit(a, "45 × 25")).toMatch(/kaydedildi/);
    expect(await ebatOf(ids[a])).toBe("45 x 25");
    expect(await edit(b, "9x14")).toMatch(/kaydedildi/);
    expect(await ebatOf(ids[b])).toBe("9 x 14");

    // Geri Al kaydı ebadı geri getirir (b: "9 x 14" → boş)
    await page.getByRole("button", { name: /Son İşlemi Geri Al/ }).click();
    await expect.poll(() => ebatOf(ids[b]), { timeout: 30_000 }).toBeNull();
    expect(await edit(b, "9 x 14")).toMatch(/kaydedildi/);
    expect(await ebatOf(ids[b])).toBe("9 x 14");

    // Mobilde (390) düzenleme formu taşmaz; ebat kutusu 16 px
    await page.setViewportSize({ width: 390, height: 844 });
    await openAdmin(page);
    await findInProductList(page, a);
    await page.locator(`#ap-${ids[a]}`).getByRole("button", { name: /Düzenle/ }).click();
    const box = page.locator(`#ap-${ids[a]}`).getByLabel("Ebat", { exact: true });
    await expect(box).toBeVisible();
    expect(await box.evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByText("Ürünün ebadı. Filtreleme ve sıralamada kullanılır.").first()).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const t of [a, b, c]) await refreshStorefront(request, ids[t]);

    const open = async (q: string) => {
      await page.goto(`${LIST}&${q}`, { waitUntil: "domcontentloaded" });
      return page.getByTestId("urun-sayisi").locator("strong").innerText({ timeout: 5000 });
    };
    const titles = async (q: string) => {
      await open(q);
      return (await page.locator("main div.group h3").allInnerTexts()).filter((t) => t.startsWith(PREFIX));
    };
    // Vitrin önbelleği (60 sn) için bekle
    await expect.poll(async () => (await open("ebat=45x25").catch(() => "")) === "1", { timeout: 90_000, intervals: [2000, 4000, 8000] }).toBe(true);

    // Ebat filtresi: rengi olmayan ürün çıkar, sayı doğru
    await open("");
    const sizes = await page.locator('#filtre-paneli input[name="ebat"]').evaluateAll((els) =>
      els.map((e) => ({ v: e.getAttribute("value") ?? "", t: (e.closest("label")?.textContent ?? "").replace(/\s+/g, " ").trim() }))
    );
    expect(sizes.find((x) => x.v === "45x25")?.t).toMatch(/^45 x 25\s*\(1\)$/);
    expect(sizes.find((x) => x.v === "9x14")?.t).toMatch(/^9 x 14\s*\(1\)$/);
    expect(await titles("ebat=45x25")).toEqual([a]);
    expect(await titles("ebat=9x14")).toEqual([b]);

    // Sıralama iki yönde: 9 x 14 < 45 x 25 (sayısal); ebatsız ürün sonda
    expect(await titles("siralama=ebat-artan")).toEqual([b, a, c]);
    expect(await titles("siralama=ebat-azalan")).toEqual([a, b, c]);
    await open("siralama=ebat-artan");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/kategori\/[^?]+$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
