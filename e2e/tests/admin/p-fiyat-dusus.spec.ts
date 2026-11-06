import { test, expect } from "../../fixtures";
import { autoDialogs, cleanupE2eProducts, createProductViaForm, openAdmin, png, uniq } from "../../admin-helpers";
import { exec, productIdByTitle, rows } from "../../db";

const PREFIX = "E2E Fiyat Düşüşü";
const MAIL = `e2e-fiyat-${uniq()}@example.invalid`;

// Müşteri hesabı arayüzden açılamaz (e-posta doğrulama kodu e-postayla gelir, e-posta kapalı): üye ve favori, kilitli e2e veritabanına doğrudan eklenir ve sonda silinir.
test.describe("Admin fiyat düşürür → favorileyen üyeye zil bildirimi", () => {
  test.afterAll(async ({ request }) => {
    await exec(`delete from "Notification" where "userEmail" = $1`, [MAIL]).catch(() => {});
    await exec(`delete from "User" where email = $1`, [MAIL]).catch(() => {}); // Favorite cascade
    await cleanupE2eProducts(request, PREFIX);
  });

  test("düşüşte tek bildirim; artışta ve 24 saat içinde ikinci düşüşte yok", async ({ page, request }) => {
    const title = `${PREFIX} ${uniq()}`;
    const dialogs = autoDialogs(page);
    await openAdmin(page);
    await createProductViaForm(page, { title, category: "Kristal", price: "1000", photos: [png(30, 30, 200)], colors: [{ name: "E2E Renk", stock: "3" }] });
    await expect.poll(() => dialogs.join("|")).toContain("vitrine eklendi");
    const id = (await productIdByTitle(title)) ?? "";
    expect(id).not.toBe("");

    await exec(`insert into "User"(id, name, email, password, "updatedAt") values (gen_random_uuid()::text, 'E2E Üye', $1, 'x', now())`, [MAIL]);
    await exec(`insert into "Favorite"(id, "userId", "productId") select gen_random_uuid()::text, u.id, $2 from "User" u where u.email = $1`, [MAIL, id]);

    const count = async () => Number((await rows<{ n: string }>(`select count(*)::text as n from "Notification" where type = 'PRICE_DROP' and "userEmail" = $1 and link = $2`, [MAIL, `/urun/${id}`]))[0].n);
    const setPrice = async (basePrice: number) => {
      const res = await request.patch("/api/admin/product", { data: { productId: id, basePrice } });
      expect(res.status(), `fiyat ${basePrice}`).toBe(200);
    };

    await setPrice(800); // düşüş → bildirim
    await expect.poll(count, { timeout: 15_000 }).toBe(1);
    const [n] = await rows<{ message: string; title: string }>(`select message, title from "Notification" where type = 'PRICE_DROP' and "userEmail" = $1`, [MAIL]);
    expect(n.message).toContain(title);
    expect(n.message).toMatch(/1\.000,00 ₺ → 800,00 ₺/);

    await setPrice(900); // artış → yok
    await setPrice(700); // 24 saat içinde ikinci düşüş → yok
    await setPrice(700); // fiyat değişmedi → yok
    await page.waitForTimeout(3000);
    expect(await count()).toBe(1);
  });
});
