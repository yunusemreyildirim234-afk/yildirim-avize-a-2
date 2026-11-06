import { test, expect, lockNetwork } from "../../fixtures";
import { autoDialogs, cleanupE2eCategories, cleanupE2eProducts, createProductViaForm, openAdmin, refreshStorefront, uniq } from "../../admin-helpers";
import { exec, productIdByTitle } from "../../db";

const PREFIX = "E2E Liste Secenek";

// Canlıdaki gibi Trendyol "Seçenek" değerleri ("Renk / EnxBoy"): yönetim formu yalnızca "Renk" türü yazdığından, E2E önekli ürünlerin varyasyonları
// e2e veritabanında (güvenlik kilidi arkasında) "Seçenek" türüne ve ham değerlere çevrilir. Ürünler sonda silinir.
test.describe("Admin: Seçenek türü renk + ebat filtresi (E2E önekli veri, sonda silinir)", () => {
  test.afterAll(async ({ request }) => {
    await cleanupE2eProducts(request, PREFIX);
    await cleanupE2eCategories(request);
  });

  test("Sarı/Bej/Pirinç Eskitme ve ebat filtreleri; renk+ebat aynı varyasyonda; sayılar, çipler, temizleme, çekmece, JS kapalı", async ({ page, request, browser, baseURL }) => {
    const tag = uniq();
    const a = `${PREFIX} A ${tag}`;
    const b = `${PREFIX} B ${tag}`;
    const c = `${PREFIX} C ${tag}`;
    // Kendi kategorisi: e2e veritabanındaki gerçek ürünler sayıları etkilemesin
    const catName = `E2E Liste Secenek ${tag}`;
    const LIST = `/kategori/${catName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}?adet=tumu`;
    const dialogs = autoDialogs(page);
    const specs: [string, string[]][] = [
      [a, ["SARI / 40 x 40", "Bej / 50 x 50"]],
      [b, ["Pirinç Eskitme", "prinç eskitme / 60 x 60"]],
      // 10 ebat daha: "Tümünü göster" için (hepsi Gold)
      [c, Array.from({ length: 10 }, (_, i) => `Gold / ${10 + i} x ${10 + i}`)],
    ];

    for (const [i, [title, vals]] of specs.entries()) {
      await openAdmin(page);
      await createProductViaForm(page, { title, category: "Kristal", price: String(1000 + i), colors: vals.map((_, j) => ({ name: `E2E Sec ${tag} ${j}` })) });
      await expect.poll(() => dialogs.filter((d) => d.includes("vitrine eklendi")).length, { timeout: 60_000 }).toBe(i + 1);
      const id = await productIdByTitle(title);
      expect(id, "ürün oluştu").toBeTruthy();
      for (const [pos, v] of vals.entries()) {
        await exec(`update "ProductVariation" set "variationType" = 'Seçenek', "variationValue" = $1 where "productId" = $2 and "position" = $3`, [v, id, pos]);
      }
      await exec(`update "Product" set "category" = $1 where id = $2`, [catName, id]);
      await refreshStorefront(request, id!);
    }

    const open = async (q: string) => {
      await page.goto(`${LIST}&${q}`, { waitUntil: "domcontentloaded" });
      return page.getByTestId("urun-sayisi").locator("strong").innerText({ timeout: 5000 });
    };
    const titles = async (q: string) => {
      await open(q);
      return (await page.locator("main div.group h3").allInnerTexts()).filter((t) => t.startsWith(PREFIX)).sort();
    };
    const labels = async (name: "renk" | "ebat") =>
      page.locator(`#filtre-paneli input[name="${name}"]`).evaluateAll((els) =>
        els.map((e) => ({ v: e.getAttribute("value") ?? "", t: (e.closest("label")?.textContent ?? "").replace(/\s+/g, " ").trim() }))
      );

    // Vitrin önbelleği (60 sn) için bekle: yalnızca A'da olan 40x40 ebatı süzülebilmeli
    await expect.poll(async () => (await open("ebat=40x40").catch(() => "")) === "1", { timeout: 90_000, intervals: [2000, 4000, 8000] }).toBe(true);

    // Renk seçenekleri: büyük/küçük harf ve yazım farkları tek seçenek, ürün başına tek sayım
    await open("");
    const colors = await labels("renk");
    const find = (arr: { v: string; t: string }[], v: string) => arr.find((x) => x.v === v)?.t;
    expect(find(colors, "sari")).toMatch(/^Sarı\s*\(1\)$/);
    expect(find(colors, "bej")).toMatch(/^Bej\s*\(1\)$/);
    expect(find(colors, "pirinc-eskitme")).toMatch(/^Pirinç Eskitme\s*\(1\)$/); // "Pirinç Eskitme" + "prinç eskitme" = tek seçenek, tek ürün
    expect(find(colors, "gold")).toMatch(/^Gold\s*\(1\)$/);
    expect(colors.some((x) => /\d/.test(x.t.replace(/\(\d+\)$/, ""))), "ölçü renk seçeneği olmamalı").toBe(false);
    expect(await titles("renk=sari")).toEqual([a]);
    expect(await titles("renk=bej")).toEqual([a]);
    expect(await titles("renk=pirinc-eskitme")).toEqual([b]);
    expect(await titles("renk=sari,pirinc-eskitme")).toEqual([a, b].sort());

    // Ebat seçenekleri ve sonuçlar
    await open("");
    const sizes = await labels("ebat");
    expect(find(sizes, "40x40")).toMatch(/^40 x 40\s*\(1\)$/);
    expect(find(sizes, "50x50")).toMatch(/^50 x 50\s*\(1\)$/);
    expect(find(sizes, "60x60")).toMatch(/^60 x 60\s*\(1\)$/);
    expect(sizes.length).toBe(13);
    expect(await titles("ebat=40x40")).toEqual([a]);
    expect(await titles("ebat=60x60")).toEqual([b]);
    expect(await titles("ebat=40x40,60x60")).toEqual([a, b].sort());
    expect(await titles("ebat=40%20X%2040")).toEqual([a]); // boşluk/X tolere edilir

    // Renk + ebat: AYNI varyasyon. A'nın Sarı'sı 40x40'ta, 50x50'si Bej'de → Sarı+50x50 eşleşmez
    expect(await titles("renk=sari&ebat=40x40")).toEqual([a]);
    expect(await titles("renk=bej&ebat=50x50")).toEqual([a]);
    expect(await open("renk=sari&ebat=50x50")).toBe("0");
    await expect(page.getByTestId("liste-bos")).toBeVisible();
    expect(await titles("renk=sari,bej&ebat=40x40,60x60")).toEqual([a]);
    // Sayılar: renk seçiliyken ebat sayıları yalnızca o rengin varyasyonlarına göre
    await open("renk=sari");
    expect((await labels("ebat")).map((x) => x.t.replace(/\s*\((\d+)\)$/, " ($1)"))).toEqual(["40 x 40 (1)"]);
    await open("ebat=50x50");
    expect((await labels("renk")).map((x) => x.t.replace(/\s*\((\d+)\)$/, " ($1)"))).toEqual(["Bej (1)"]);

    // Geçersiz ebat sessizce yok sayılır; filtreli adres noindex
    const all = await open("");
    expect(await open("ebat=abc,9x9,45,%3Cscript%3E")).toBe(all);
    await open("ebat=40x40");
    expect(await page.evaluate(() => document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "")).toContain("noindex");

    // Çipler ve temizleme (JS'li, masaüstü)
    await open("ebat=40x40,50x50");
    const chips = page.getByRole("group", { name: "Seçili filtreler" });
    await expect(chips.getByRole("link", { name: /Ebat: 40 x 40/ })).toBeVisible();
    await chips.getByRole("link", { name: /Ebat: 40 x 40/ }).click();
    await expect(page).toHaveURL(/ebat=50x50(&|$)/);
    await page.getByRole("link", { name: "Filtreleri temizle" }).first().click();
    await expect(page).not.toHaveURL(/ebat=/);

    // Masaüstü: kutu işaretlenince hemen uygulanır; ilk 8 görünür, "Tümünü göster / Daha az göster"
    await open("");
    const group = page.getByTestId("ebat-grubu");
    const visibleBoxes = () => group.locator('input[name="ebat"]:visible').count();
    await expect(page.getByTestId("ebat-tumu")).toBeVisible();
    expect(await visibleBoxes()).toBe(8);
    await page.getByTestId("ebat-tumu").click();
    expect(await visibleBoxes()).toBe(13);
    await page.getByTestId("ebat-tumu").click();
    expect(await visibleBoxes()).toBe(8);
    await page.getByTestId("ebat-tumu").click();
    await group.locator('input[name="ebat"][value="40x40"]').check();
    await expect(page).toHaveURL(/ebat=40x40/);
    expect(await page.getByTestId("urun-sayisi").locator("strong").innerText()).toBe("1");

    // Mobil çekmece: aynı Ebat bölümü, "Uygula" ile; renk + ebat birlikte
    await page.setViewportSize({ width: 390, height: 844 });
    await open("");
    await page.getByTestId("filtre-ac").click();
    const dialog = page.getByRole("dialog", { name: "Filtrele ve Sırala" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("ebat-grubu")).toBeVisible();
    await dialog.locator('input[name="renk"][value="sari"]').check();
    await dialog.getByTestId("ebat-tumu").click(); // 50x50 ilk 8'in dışında
    await dialog.locator('input[name="ebat"][value="50x50"]').check();
    await dialog.getByRole("button", { name: /^Uygula/ }).click();
    await expect(page).toHaveURL(/renk=sari/);
    await expect(page).toHaveURL(/ebat=50x50/);
    await expect(page.getByTestId("liste-bos")).toBeVisible(); // Sarı + 50x50 aynı varyasyonda yok
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 800 });

    // JS kapalı: tümü görünür (daralt düğmesi yok), GET formu repeated parametreyle süzer
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
    await lockNetwork(ctx, baseURL!);
    const p2 = await ctx.newPage();
    try {
      await p2.goto(LIST, { waitUntil: "domcontentloaded" });
      await expect(p2.locator('#filtre-paneli input[name="ebat"]:visible')).toHaveCount(13);
      await expect(p2.getByTestId("ebat-tumu")).toHaveCount(0);
      await p2.goto(`${LIST}&ebat=40x40&ebat=60x60`, { waitUntil: "domcontentloaded" });
      expect((await p2.locator("main div.group h3").allInnerTexts()).filter((t) => t.startsWith(PREFIX)).sort()).toEqual([a, b].sort());
    } finally {
      await ctx.close();
    }
  });
});
