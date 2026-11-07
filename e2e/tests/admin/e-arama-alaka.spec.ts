import { test, expect } from "../../fixtures";
import { autoDialogs, cleanupE2eProducts, createProductViaForm, openAdmin, uniq } from "../../admin-helpers";
import { productIdByTitle } from "../../db";

const PREFIX = "E2E Alaka";

// /arama "önerilen" sıralaması: tüm kelimeler başlıkta olanlar önde; puanı eşit aksesuar, avize ürününün arkasına düşer (diğer sıralamalar değişmez).
test.describe("Admin: arama alaka sırası (E2E önekli veri, sonda silinir)", () => {
  test.afterAll(async ({ request }) => {
    await cleanupE2eProducts(request, PREFIX);
  });

  test("aksesuar, aynı puanlı avizenin arkasında; 'en yeni' sıralaması değişmez", async ({ page }) => {
    const tag = uniq();
    const avize = `${PREFIX} ${tag} kristal Avize`;
    const aksesuar = `${PREFIX} ${tag} kristal Damla`;
    const dialogs = autoDialogs(page);
    // Önce avize, sonra aksesuar oluşur: varsayılan (güncellik) sırasında aksesuar ÖNDE olur
    for (const [i, [title, category]] of ([[avize, "Kristal"], [aksesuar, "Aksesuar"]] as const).entries()) {
      await openAdmin(page);
      await createProductViaForm(page, { title, category, price: "1500", colors: [{ name: "E2E Renk" }] });
      await expect.poll(() => dialogs.filter((d) => d.includes("vitrine eklendi")).length, { timeout: 60_000 }).toBe(i + 1);
    }
    const [idAvize, idAks] = [(await productIdByTitle(avize))!, (await productIdByTitle(aksesuar))!];
    expect(idAvize && idAks).toBeTruthy();

    const order = async (q: string) => {
      await page.goto(`/arama?q=${encodeURIComponent(`${PREFIX} ${tag} kristal`)}${q}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("urun-sayisi")).toBeVisible();
      const hrefs = await page.locator('main a[href^="/urun/"]').evaluateAll((els) => els.map((a) => a.getAttribute("href") ?? ""));
      return [...new Set(hrefs)].map((h) => h.replace("/urun/", "")).filter((id) => id === idAvize || id === idAks);
    };
    // Önceki davranış (güncellik sırası) "en yeni" ile görünür: aksesuar önde
    expect(await order("&siralama=en-yeni")).toEqual([idAks, idAvize]);
    // Yeni kural: varsayılan "önerilen" sırada avize önde
    expect(await order("")).toEqual([idAvize, idAks]);
    expect(await order("&siralama=onerilen")).toEqual([idAvize, idAks]);
  });
});
