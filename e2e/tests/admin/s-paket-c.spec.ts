import { test, expect } from "../../fixtures";
import { cleanupE2eProducts, createProductViaForm, expandPanel, findInProductList, openAdmin, png, uniq } from "../../admin-helpers";
import { productIdByTitle, rows } from "../../db";

const PREFIX = "E2E Paket C";
const stockOf = async (id: string) => (await rows<{ stock: number }>(`select stock from "ProductVariation" where "productId" = $1 order by position limit 1`, [id]))[0]?.stock;

test.describe("Admin paket C: stok düğmeleri, silme düğmeleri, Trendyol varsayılanı", () => {
  test.afterAll(async ({ request }) => {
    await cleanupE2eProducts(request, PREFIX);
  });

  test("stok −/+ düğmeleri büyük ve ayrık; değişince 'Stok 7 → 8' bildirimi ve Geri Al çalışır; Modeli Sil ayrı ve onaylı", async ({ page }) => {
    const title = `${PREFIX} ${uniq()}`;
    let id = "";
    page.on("dialog", (d) => void d.accept());

    await test.step("E2E ürünü oluştur ve listede bul", async () => {
      await openAdmin(page);
      await createProductViaForm(page, { title, category: "Kristal", price: "999", photos: [png(10, 120, 200)], colors: [{ name: "E2E Renk", stock: "7" }] });
      await expect.poll(async () => (await productIdByTitle(title)) ?? "", { timeout: 30_000 }).not.toBe("");
      id = (await productIdByTitle(title))!;
      await openAdmin(page);
      await findInProductList(page, title);
      await expect(page.locator(`#ap-${id}`)).toBeVisible();
    });

    const rowEl = () => page.locator(`#ap-${id}`);
    const dec = () => rowEl().getByRole("button", { name: /stoğunu azalt/ });
    const inc = () => rowEl().getByRole("button", { name: /stoğunu artır/ });

    await test.step("masaüstü: ≥36×36 px ve düğmeler arası boşluk ≥8 px", async () => {
      const [a, b] = [(await dec().boundingBox())!, (await inc().boundingBox())!];
      for (const box of [a, b]) {
        expect(box.width).toBeGreaterThanOrEqual(36);
        expect(box.height).toBeGreaterThanOrEqual(36);
      }
      expect(b.x - (a.x + a.width), "− ile + arası boşluk").toBeGreaterThanOrEqual(8);
    });

    await test.step("mobil genişlik: ≥40×40 px", async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const box of [(await dec().boundingBox())!, (await inc().boundingBox())!]) {
        expect(box.width).toBeGreaterThanOrEqual(40);
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
      await page.setViewportSize({ width: 1280, height: 800 });
    });

    await test.step("+ → stok 8, bildirim 'Stok 7 → 8' + Geri Al; Geri Al stoğu 7'ye döndürür", async () => {
      await inc().click();
      await expect.poll(() => stockOf(id), { timeout: 30_000 }).toBe(8);
      const bar = page.getByRole("status").filter({ hasText: "Stok 7 → 8" });
      await expect(bar).toBeVisible();
      await bar.getByRole("button", { name: /Geri Al/ }).click();
      await expect.poll(() => stockOf(id), { timeout: 30_000 }).toBe(7);
    });

    await test.step("Modeli Sil: Düzenle ile aynı yükseklik, kırmızı ton, ≥12 px uzak; onay metni ürün adını içerir; vazgeçince silinmez", async () => {
      const edit = rowEl().getByRole("button", { name: /Düzenle/ });
      const del = rowEl().getByRole("button", { name: /Modeli Sil/ });
      const [e, d] = [(await edit.boundingBox())!, (await del.boundingBox())!];
      expect(d.height, "aynı yükseklik").toBeGreaterThanOrEqual(e.height - 1);
      expect(d.x - (e.x + e.width), "Düzenle ile Sil arası").toBeGreaterThanOrEqual(12);
      // Renk değeri tarayıcıda lab/oklch döner; ton, tehlike (kırmızı) sınıflarıyla doğrulanır
      expect(await del.getAttribute("class")).toMatch(/text-red-700/);
      expect(await del.evaluate((el) => getComputedStyle(el).color)).not.toBe(await edit.evaluate((el) => getComputedStyle(el).color));
      expect(await del.evaluate((el) => getComputedStyle(el).borderTopWidth)).not.toBe("0px");

      page.removeAllListeners("dialog");
      let message = "";
      page.once("dialog", (dlg) => {
        message = dlg.message();
        void dlg.dismiss();
      });
      await del.click();
      await expect.poll(() => message).toContain(title);
      expect(await productIdByTitle(title), "vazgeçince ürün durur").toBe(id);
    });
  });

  test("Trendyol: varsayılan mod 'Yalnızca stok' (stok Ezerek, diğerleri Dokunma); 'Normal: hepsi' bilinçli seçilir", async ({ page }) => {
    await openAdmin(page);
    await expandPanel(page, /Trendyol Ürünleri/);
    const radio = (field: string, mode: string) => page.getByRole("radio", { name: `${field}: ${mode}`, exact: true });
    await expect(radio("Stok", "Ezerek")).toBeChecked();
    for (const f of ["Fiyat (satış, liste, varyasyon farkı)", "Başlık ve açıklama", "Görseller", "Kategori ve marka", "Varyasyon adı ve stok kodu", "Aktif/pasif (Trendyol'dan kalkanlar)"]) {
      await expect(radio(f, "Dokunma")).toBeChecked();
    }
    await page.getByRole("button", { name: /Normal: hepsi/ }).click();
    await expect(radio("Stok", "Elle değiştirdiklerimi koru")).toBeChecked();
    await expect(radio("Görseller", "Elle değiştirdiklerimi koru")).toBeChecked();
  });

  test("müşteri hareketleri: 'Düzenle' ve 'Kaydı Sil' aynı yükseklikte, ayrık (yalnızca düzenlenebilir üye varsa)", async ({ page }) => {
    await openAdmin(page);
    await expandPanel(page, /Müşteriler & Son 3 Gün/);
    const li = page.locator("li", { has: page.getByRole("button", { name: "Düzenle", exact: true }) }).filter({ has: page.getByRole("button", { name: "Kaydı Sil" }) }).first();
    test.skip((await li.count()) === 0, "E2E veritabanında düzenlenebilir üyenin hareket kaydı yok");
    const [e, d] = [(await li.getByRole("button", { name: "Düzenle", exact: true }).boundingBox())!, (await li.getByRole("button", { name: "Kaydı Sil" }).boundingBox())!];
    expect(Math.abs(e.height - d.height)).toBeLessThanOrEqual(1);
    expect(d.x - (e.x + e.width)).toBeGreaterThanOrEqual(12);
  });

  // Elle görsel inceleme için: SHOTS=<klasör> verilirse katalog satırı ve Trendyol panelinin görüntüsünü alır (verilmezse atlanır)
  test("görsel inceleme ekran görüntüleri (isteğe bağlı)", async ({ page }) => {
    const dir = process.env.SHOTS;
    test.skip(!dir, "SHOTS tanımlı değil");
    const title = `${PREFIX} ${uniq()}`;
    page.on("dialog", (d) => void d.accept());
    await openAdmin(page);
    await createProductViaForm(page, { title, category: "Kristal", price: "999", photos: [png(10, 120, 200)], colors: [{ name: "E2E Renk", stock: "7" }, { name: "E2E Renk İki", stock: "3" }] });
    await expect.poll(async () => (await productIdByTitle(title)) ?? "", { timeout: 30_000 }).not.toBe("");
    const id = (await productIdByTitle(title))!;
    await openAdmin(page);
    await findInProductList(page, title);
    const row = page.locator(`#ap-${id}`);
    await row.scrollIntoViewIfNeeded();
    await row.screenshot({ path: `${dir}/c-satir-1280.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await row.scrollIntoViewIfNeeded();
    await row.screenshot({ path: `${dir}/c-satir-390.png` });
    await page.setViewportSize({ width: 1280, height: 800 });
    await expandPanel(page, /Trendyol Ürünleri/);
    await page.locator("#trendyol").screenshot({ path: `${dir}/c-trendyol-1280.png` });
  });
});
