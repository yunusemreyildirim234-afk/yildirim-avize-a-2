import { test, expect } from "../../fixtures";
import { uniq } from "../../admin-helpers";
import { exec, rows } from "../../db";
import { couponUsed, orderById, variationStock } from "../../order-helpers";
import { PREFIX, cleanupHardening, clientHeaders, createProduct, dbNow, seedOrder, seedUser } from "../../hardening-helpers";

// Havale: bekleyen sınırı, son ürün yarışı, otomatik iptal. /api/order'a bu dosyadan 3 istek gider, kendi x-forwarded-for sayacıyla (5/10 dk bütçesi aşılmaz).
test.describe.configure({ mode: "serial" });

const HEADERS = clientHeaders(10);
const orderBody = (variationId: string, email: string, phone: string) => ({
  name: "E2E Havale",
  email,
  phone,
  address: "E2E Test Mah.",
  shippingType: "BEYOGLU_MAGAZA_TESLIM",
  paymentMethod: "BANK_TRANSFER",
  consent: true,
  items: [{ variationId, quantity: 1 }],
});

test.describe("Havale sertleştirme", () => {
  const sfx = uniq();
  const couponCode = `E2EHAVALE${sfx.toUpperCase()}`;
  let since = "";
  let plenty = { id: "", variationId: "" };
  let last = { id: "", variationId: "" };

  test.afterAll(async ({ request }) => {
    await cleanupHardening(request, since).catch((e) => console.error("[r-havale] temizlik:", (e as Error).message));
    const cs = await rows<{ id: string }>(`select id from "Coupon" where code = $1`, [couponCode]).catch(() => []);
    for (const c of cs) await request.delete("/api/admin/coupons", { data: { id: c.id } }).catch(() => {});
  });

  test("hazırlık: iki E2E ürünü (stok 10 ve stok 1)", async ({ page }) => {
    since = await dbNow();
    const a = await createProduct(page, `${PREFIX} Bol ${sfx}`, 10);
    const b = await createProduct(page, `${PREFIX} Son ${sfx}`, 1);
    plenty = { id: a.id, variationId: a.variation.id };
    last = { id: b.id, variationId: b.variation.id };
  });

  test("(a) aynı iletişim bilgisiyle iki bekleyen havale varken yeni sipariş reddedilir, stok değişmez", async ({ request }) => {
    const email = `e2e-limit-${sfx}@example.invalid`;
    const phone = "0500 000 10 01";
    const userId = await seedUser(email, "E2E Limit");
    for (let i = 0; i < 2; i++) await seedOrder({ userId, status: "PENDING_NEW", paymentMethod: "BANK_TRANSFER", phone, ageHours: 1 });
    const before = await variationStock(plenty.variationId);
    const res = await request.post("/api/order", { headers: HEADERS, data: orderBody(plenty.variationId, email, phone) });
    expect(res.status()).toBe(429);
    expect(((await res.json()) as { error: string }).error).toContain("Ödemesi beklenen Havale/EFT siparişleriniz var");
    expect(await variationStock(plenty.variationId)).toBe(before);
    expect((await rows<{ n: number }>(`select count(*)::int as n from "Order" where "userId" = $1`, [userId]))[0].n, "yeni sipariş açılmadı; eskiler iptal edilmedi").toBe(2);
  });

  test("(b) son ürün için iki paralel havale siparişinden yalnızca biri açılır, stok eksiye düşmez", async ({ request }) => {
    const responses = await Promise.all(
      [1, 2].map((n) => request.post("/api/order", { headers: HEADERS, timeout: 60_000, data: orderBody(last.variationId, `e2e-yaris${n}-${sfx}@example.invalid`, `0500 000 20 0${n}`) }))
    );
    expect(responses.map((r) => r.status()).sort()).toEqual([200, 400]);
    const rejected = responses.find((r) => r.status() === 400)!;
    expect(((await rejected.json()) as { error: string }).error).toContain("stok yetersiz");
    expect(await variationStock(last.variationId)).toBe(0);
    const orders = await rows<{ stockDeducted: boolean; status: string }>(`select o."stockDeducted", o.status from "Order" o join "OrderItem" i on i."orderId" = o.id where i."variationId" = $1`, [last.variationId]);
    expect(orders).toEqual([{ stockDeducted: true, status: "PENDING_NEW" }]);
  });

  test("(c) süresi dolan dekontsuz havale iptal olur; stok ve kupon bir kez iade edilir; dekontlu ve süresi dolmamış olana dokunulmaz", async ({ request }) => {
    const created = await request.post("/api/admin/coupons", { data: { code: couponCode, discountType: "PERCENT", discountPercent: 10, maxUses: 5, minCartTotal: 0, expiresAt: "" } });
    expect(created.ok(), `kupon: ${created.status()}`).toBe(true);
    await exec(`update "Coupon" set "usedCount" = 1 where code = $1`, [couponCode]);

    const userId = await seedUser(`e2e-iptal-${sfx}@example.invalid`, "E2E İptal");
    const item = { variationId: plenty.variationId, quantity: 2 };
    const base = { userId, status: "PENDING_NEW", paymentMethod: "BANK_TRANSFER" as const, stockDeducted: true, item };
    const expired = await seedOrder({ ...base, phone: "0500 000 30 01", ageHours: 49, couponCode });
    const withReceipt = await seedOrder({ ...base, phone: "0500 000 30 02", ageHours: 49, receiptUrl: "/api/receipts/e2e" });
    const young = await seedOrder({ ...base, phone: "0500 000 30 03", ageHours: 47 });
    const stockBefore = await variationStock(plenty.variationId);

    const auth = { Authorization: `Bearer ${process.env.E2E_CRON_SECRET}` };
    for (let run = 0; run < 2; run++) {
      const res = await request.get("/api/cron/reminders", { headers: auth, timeout: 180_000 });
      expect(res.status(), `cron ${run + 1}`).toBe(200);
    }

    const o = (await orderById(expired))!;
    expect(o.status).toBe("CANCELLED");
    expect(o.stockDeducted).toBe(false);
    expect(await variationStock(plenty.variationId), "stok yalnızca bir kez iade edildi").toBe(stockBefore + 2);
    expect(await couponUsed(couponCode), "kupon yalnızca bir kez iade edildi").toBe(0);
    expect((await orderById(withReceipt))!.status, "dekontlu sipariş iptal edilmez").toBe("PENDING_NEW");
    expect((await orderById(young))!.status, "süresi dolmamış sipariş iptal edilmez").toBe("PENDING_NEW");
    expect((await rows(`select 1 from "Notification" where title = $1 and "userId" is null`, [`Havale siparişi otomatik iptal: #${expired.slice(0, 8)}`])).length, "yönetici bildirimi tek").toBe(1);
    expect((await rows(`select 1 from "Notification" where title = 'Siparişiniz iptal edildi' and "userId" = $1`, [userId])).length, "müşteri bildirimi tek").toBe(1);

    // Yetkisiz çağrı kapalı kalır
    expect((await request.get("/api/cron/reminders", { headers: { Authorization: "Bearer yanlis" } })).status()).toBe(401);
  });
});
