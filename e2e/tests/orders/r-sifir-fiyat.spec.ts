import { test, expect } from "../../fixtures";
import { exec, rows } from "../../db";
import { CUSTOMER, cartItem, newGuest, submitButton, waitProductPage } from "../../order-helpers";

// Fiyatı 0 olan ürün satın alınamaz: /api/cart/quote kalemi reddeder, /api/order 400 döner (sipariş OLUŞMAZ), sepet nedeni gösterir,
// ürün sayfasında "Sepete Ekle" yerine "Fiyat için sorun" çıkar. Geçici ürün "E2E " önekli; afterAll siler.
// /api/order'a EN FAZLA 1 istek gider (hız sınırı bütçesi: p-siparis 4 + bu 1 = 5 / 10 dk).
const TITLE = "E2E Sifir Fiyat Urun";
let pid = "";
let vid = "";

test.describe.configure({ mode: "serial" });

test.describe("Fiyatı 0 olan ürün", () => {
  test.beforeAll(async () => {
    await exec(`delete from "Product" where title = $1`, [TITLE]);
    const [p] = await rows<{ id: string }>(`insert into "Product" (id, title, category, "basePrice", active, "updatedAt") values (gen_random_uuid()::text, $1, 'E2E Sifir Kat', 0, true, now()) returning id`, [TITLE]);
    pid = p.id;
    const [v] = await rows<{ id: string }>(`insert into "ProductVariation" (id, "productId", "variationType", "variationValue", "extraPrice", stock, position) values (gen_random_uuid()::text, $1, 'Renk', 'Gold', 0, 5, 0) returning id`, [pid]);
    vid = v.id;
  });
  test.afterAll(async () => {
    await exec(`delete from "Product" where title = $1`, [TITLE]).catch(() => {});
  });

  test("ürün sayfası: Sepete Ekle yok, Fiyat için sorun (WhatsApp) var", async ({ browser, baseURL }) => {
    const g = await newGuest(browser, baseURL!);
    await waitProductPage(g.ctx.request, pid);
    await g.page.goto(`/urun/${pid}`, { waitUntil: "domcontentloaded" });
    await expect(g.page.getByTestId("fiyat-sor")).toBeVisible();
    await expect(g.page.getByTestId("fiyat-sor")).toHaveAttribute("href", /wa\.me\//);
    await expect(g.page.getByRole("button", { name: /^Sepete Ekle$/ })).toHaveCount(0);
    await expect(g.page.getByTestId("stok-yok-bolumu")).toHaveCount(0); // Tükendi mantığıyla çakışmaz
    await g.ctx.close();
  });

  test("/api/cart/quote kalemi reddeder; sepet nedeni gösterir ve ödeme kapalı kalır", async ({ browser, baseURL }) => {
    const g = await newGuest(browser, baseURL!, { cart: [cartItem({ productId: pid, variationId: vid, title: TITLE, variationName: "Renk: Gold", price: 500, quantity: 1 })] });
    const q = await g.ctx.request.post("/api/cart/quote", { data: { items: [{ variationId: vid, qty: 1 }], deliveryMethod: "STANDART_KARGO", paymentMethod: "BANK_TRANSFER" } });
    expect(q.status()).toBe(200);
    const body = (await q.json()) as { lines: { available: boolean; reason?: string; message?: string }[]; totals: { itemsTotal: number } };
    expect(body.lines[0]).toMatchObject({ available: false, reason: "price" });
    expect(body.lines[0].message).toContain(TITLE);
    expect(body.totals.itemsTotal).toBe(0);

    await g.page.goto("/sepet", { waitUntil: "domcontentloaded" });
    await expect(g.page.getByText(/güncel fiyat bilgisi yok/).first()).toBeVisible();
    if (await submitButton(g.page).count()) await expect(submitButton(g.page)).toBeDisabled();
    expect(g.serverErrors).toEqual([]);
    await g.ctx.close();
  });

  test("/api/order (havale) 400 döner ve sipariş oluşmaz", async ({ browser, baseURL }) => {
    const g = await newGuest(browser, baseURL!);
    const before = (await rows<{ n: number }>(`select count(*)::int as n from "OrderItem" where "variationId" = $1`, [vid]))[0].n;
    const res = await g.ctx.request.post("/api/order", {
      data: { name: CUSTOMER.name, email: CUSTOMER.email, phone: CUSTOMER.phone, address: CUSTOMER.address, shippingType: "STANDART_KARGO", paymentMethod: "BANK_TRANSFER", consent: true, items: [{ variationId: vid, quantity: 1 }] },
    });
    expect(res.status()).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("güncel fiyat bilgisi yok");
    expect((await rows<{ n: number }>(`select count(*)::int as n from "OrderItem" where "variationId" = $1`, [vid]))[0].n, "sipariş kalemi oluşmadı").toBe(before);
    expect(g.serverErrors).toEqual([]);
    await g.ctx.close();
  });
});
