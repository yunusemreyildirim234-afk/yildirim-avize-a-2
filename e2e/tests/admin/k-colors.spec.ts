import type { Page } from "@playwright/test";
import { test, expect, realImageUrl } from "../../fixtures";
import { autoDialogs, cleanupE2eProducts, createProductViaForm, findInProductList, openAdmin, png, uniq } from "../../admin-helpers";
import { productIdByTitle, rows } from "../../db";

const PREFIX = "E2E Renkli Ürün";

/** Ürün sayfası galerisindeki görsel adresleri (küçük resim şeridi varsa onlar, yoksa ana görsel). */
async function gallery(page: Page, title: string): Promise<string[]> {
  const thumbs = page.getByRole("tablist", { name: "Ürün fotoğrafları" }).getByRole("tab").locator("img");
  if ((await thumbs.count()) > 0) return (await thumbs.evaluateAll((els) => els.map((i) => i.getAttribute("src") ?? ""))).map((s) => realImageUrl(s) ?? "");
  const main = await page.locator(`main img[alt="${title}"]`).first().getAttribute("src");
  return [realImageUrl(main) ?? ""];
}

const dbImages = async (id: string) => (await rows<{ images: string[] }>(`select images from "Product" where id = $1`, [id]))[0].images;
const dbColors = async (id: string) => rows<{ variationValue: string; images: string[]; position: number }>(`select "variationValue", images, position from "ProductVariation" where "productId" = $1 order by position, id`, [id]);

test.describe("Admin: renkli ürün ve fotoğraf yönetimi", () => {
  test.afterAll(async ({ request }) => {
    await cleanupE2eProducts(request, PREFIX);
  });

  test("2 renkli ürün: galeri, renk seçimi, kapak/sıra, renk sırası", async ({ page }) => {
    const title = `${PREFIX} ${uniq()}`;
    const dialogs = autoDialogs(page);
    let id = "";

    await test.step("oluştur: 2 genel + renk A (2) + renk B (1) fotoğraf", async () => {
      await openAdmin(page);
      await createProductViaForm(page, {
        title,
        category: "Kristal",
        photos: [png(220, 20, 20, "g1.png"), png(20, 160, 40, "g2.png")],
        colors: [
          { name: "E2E Renk A", photos: [png(20, 20, 220, "a1.png"), png(20, 200, 220, "a2.png")] },
          { name: "E2E Renk B", photos: [png(230, 220, 20, "b1.png")] },
        ],
      });
      await expect.poll(() => dialogs.join("|"), { timeout: 60_000 }).toContain("vitrine eklendi");
      id = (await productIdByTitle(title)) ?? "";
      expect(id).not.toBe("");
      expect(await dbImages(id)).toHaveLength(2);
      const colors = await dbColors(id);
      expect(colors.map((c) => c.images.length)).toEqual([2, 1]);
    });

    await test.step("ürün sayfası genel galeriyle açılır; renk seçince yalnızca o rengin fotoğrafları görünür", async () => {
      const general = await dbImages(id);
      const [a, b] = await dbColors(id);
      await page.goto(`/urun/${id}`);
      expect(await gallery(page, title), "açılışta genel galeri").toEqual(general);

      await page.getByRole("radio", { name: /E2E Renk A/ }).click();
      expect(await gallery(page, title), "renk A seçili").toEqual(a.images);
      await page.getByRole("radio", { name: /E2E Renk B/ }).click();
      expect(await gallery(page, title), "renk B seçili").toEqual(b.images);
    });

    const openEditor = async () => {
      await openAdmin(page);
      await findInProductList(page, title);
      await page.locator(`#ap-${id}`).getByRole("button", { name: /Düzenle/ }).click();
      return page.locator(`#ap-${id}`);
    };

    await test.step('"Kapak yap" kart kapağına yansır', async () => {
      const before = await dbImages(id);
      const card = await openEditor();
      await card.locator('li:has(img[alt="Ürün fotoğrafı 2"])').getByRole("button", { name: "Kapak yap" }).click();
      await expect(card.locator('img[alt="Ürün fotoğrafı 1"]')).toHaveAttribute("src", before[1]);
      dialogs.length = 0;
      await card.getByRole("button", { name: "Bilgileri ve Fotoğrafları Kaydet" }).click();
      await expect.poll(() => dialogs.join("|")).toContain("kaydedildi");
      expect(await dbImages(id)).toEqual([before[1], before[0]]);
      await page.goto("/kategori/kristal");
      const cardImg = realImageUrl(await page.locator(`a[href="/urun/${id}"] img`).first().getAttribute("src"));
      expect(cardImg, "kart kapağı").toBe(before[1]);
    });

    await test.step("▲▼ ile sıra değişikliği kart kapağına yansır", async () => {
      const before = await dbImages(id);
      const card = await openEditor();
      await card.getByRole("button", { name: "2. fotoğrafı öne al" }).first().click(); // genel fotoğraf şeridinin ilk eşleşmesi
      await expect(card.locator('img[alt="Ürün fotoğrafı 1"]')).toHaveAttribute("src", before[1]);
      dialogs.length = 0;
      await card.getByRole("button", { name: "Bilgileri ve Fotoğrafları Kaydet" }).click();
      await expect.poll(() => dialogs.join("|")).toContain("kaydedildi");
      expect(await dbImages(id)).toEqual([before[1], before[0]]);
      await page.goto("/kategori/kristal");
      expect(realImageUrl(await page.locator(`a[href="/urun/${id}"] img`).first().getAttribute("src"))).toBe(before[1]);
      await page.goto(`/urun/${id}`);
      expect((await gallery(page, title))[0], "ürün sayfası ilk görsel").toBe(before[1]);
    });

    await test.step("renk sırası kaydedilir ve ürün sayfasına yansır", async () => {
      const card = await openEditor();
      await card.getByRole("button", { name: "E2E Renk B rengini yukarı al" }).click();
      dialogs.length = 0;
      await card.getByRole("button", { name: "Renk Sırasını Kaydet" }).click();
      await expect.poll(() => dialogs.join("|")).toContain("Renk sırası kaydedildi");
      expect((await dbColors(id)).map((c) => c.variationValue)).toEqual(["E2E Renk B", "E2E Renk A"]);
      await page.goto(`/urun/${id}`);
      const names = await page.getByRole("radio").evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));
      expect(names[0]).toContain("E2E Renk B");
      expect(names[1]).toContain("E2E Renk A");
    });
  });
});
