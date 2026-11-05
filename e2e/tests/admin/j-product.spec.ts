import { test, expect } from "../../fixtures";
import { autoDialogs, cleanupE2eProducts, createProductViaForm, findInProductList, openAdmin, png, refreshStorefront, uniq } from "../../admin-helpers";
import { exec, productIdByTitle, rows } from "../../db";

const PREFIX = "E2E Test Ürün";

test.describe("Admin ürün: oluştur → vitrinde görün → pasif → aktif → sil", () => {
  test.afterAll(async ({ request }) => {
    await cleanupE2eProducts(request, PREFIX);
  });

  test("yaşam döngüsü", async ({ page, request }) => {
    const title = `${PREFIX} ${uniq()}`;
    const dialogs = autoDialogs(page);
    let id = "";

    await test.step("formdan oluştur (kategori, fiyat, stok, fotoğraf)", async () => {
      await openAdmin(page);
      await createProductViaForm(page, { title, category: "Kristal", price: "4321", photos: [png(200, 30, 30)], colors: [{ name: "E2E Renk", stock: "7" }] });
      await expect.poll(() => dialogs.join("|")).toContain("vitrine eklendi");
      id = (await productIdByTitle(title)) ?? "";
      expect(id, "ürün veritabanında").not.toBe("");
    });

    await test.step("kategori sayfasında ve aramada görünür", async () => {
      await page.goto("/kategori/kristal");
      await expect(page.locator(`a[href="/urun/${id}"]`).first()).toBeVisible();
      const res = await request.get(`/api/search?q=${encodeURIComponent(title)}`);
      expect(((await res.json()) as { products: { id: string }[] }).products.map((p) => p.id)).toContain(id);
      const prod = await page.goto(`/urun/${id}`);
      expect(prod!.status()).toBe(200);
      await expect(page.locator("h1")).toHaveText(title);
      await expect(page.getByRole("radio", { name: /E2E Renk/ })).toBeVisible();
    });

    await test.step("pasife alınca kaybolur (arayüzde pasife alma yok: veritabanından)", async () => {
      await exec(`update "Product" set active = false where id = $1`, [id]);
      await refreshStorefront(request, id);
      await page.goto("/kategori/kristal");
      await expect(page.locator(`a[href="/urun/${id}"]`)).toHaveCount(0);
      const res = await request.get(`/api/search?q=${encodeURIComponent(title)}`);
      expect(((await res.json()) as { products: { id: string }[] }).products.map((p) => p.id)).not.toContain(id);
      const prod = await request.get(`/urun/${id}`);
      test.info().annotations.push({ type: "pasif-urun-sayfasi-durumu", description: String(prod.status()) });
    });

    await test.step("tekrar aktifte döner", async () => {
      await exec(`update "Product" set active = true where id = $1`, [id]);
      await refreshStorefront(request, id);
      await page.goto("/kategori/kristal");
      await expect(page.locator(`a[href="/urun/${id}"]`).first()).toBeVisible();
    });

    await test.step("yönetim listesinden sil", async () => {
      await openAdmin(page);
      await findInProductList(page, title);
      await expect(page.locator(`#ap-${id}`)).toBeVisible();
      dialogs.length = 0;
      const imgs = await rows<{ id: string }>(`select id from "ProductImage" where "productId" = $1`, [id]);
      await page.locator(`#ap-${id}`).getByRole("button", { name: /Modeli Sil/ }).click();
      await expect.poll(() => dialogs.join("|")).toContain("katalogdan silindi");
      expect(await productIdByTitle(title)).toBeNull();
      // Silinen ürünün görselleri ürüne bağsız kalır (Geri Al içindir); test verisi olarak temizlenir.
      await exec(`delete from "ProductImage" where id = any($1) and "productId" is null`, [imgs.map((i) => i.id)]);
      await page.goto("/kategori/kristal");
      await expect(page.locator(`a[href="/urun/${id}"]`)).toHaveCount(0);
      expect((await request.get(`/urun/${id}`)).status()).toBe(404);
    });
  });
});
