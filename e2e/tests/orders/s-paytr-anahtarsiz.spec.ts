import crypto from "node:crypto";
import { test, expect } from "../../fixtures";
import { uniq } from "../../admin-helpers";
import { orderById } from "../../order-helpers";
import { cleanupHardening, dbNow, seedOrder, seedUser } from "../../hardening-helpers";

// e2e sunucusunda PayTR anahtarları boştur: boş anahtarla üretilmiş "geçerli" imza bile işlem yaptıramamalı. PayTR'ye istek gitmez.
test.describe("PayTR bildirimi: anahtar yokken", () => {
  let since = "";

  test.afterAll(async ({ request }) => {
    await cleanupHardening(request, since).catch((e) => console.error("[s-paytr] temizlik:", (e as Error).message));
  });

  test("(d) boş anahtarla imzalanmış success sipariş durumunu değiştirmez, OK dönmez", async ({ request }) => {
    since = await dbNow();
    const userId = await seedUser(`e2e-paytr-${uniq()}@example.invalid`, "E2E Paytr");
    const orderId = await seedOrder({ userId, status: "AWAITING_PAYMENT", paymentMethod: "CREDIT_CARD", phone: "0500 000 40 01", stockDeducted: true });
    const merchant_oid = orderId.replace(/-/g, "");
    const status = "success";
    const total_amount = "123450";
    const hash = crypto.createHmac("sha256", "").update(`${merchant_oid}${status}${total_amount}`).digest("base64");

    const res = await request.post("/api/paytr/callback", { form: { merchant_oid, status, total_amount, hash } });
    expect(res.status()).toBe(500);
    expect(await res.text()).not.toBe("OK");
    const o = (await orderById(orderId))!;
    expect(o.status).toBe("AWAITING_PAYMENT");
    expect(o.stockDeducted).toBe(true);

    // PayTR URL kontrolü ve eksik parametreli test isteği eskisi gibi OK alır
    expect(await (await request.get("/api/paytr/callback")).text()).toBe("OK");
    expect(await (await request.post("/api/paytr/callback", { form: { merchant_oid } })).text()).toBe("OK");
  });
});
