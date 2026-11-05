import { test, expect } from "../fixtures";

// Yalnızca anonim (oturumsuz) istekler; var olmayan, açıkça sahte kimlikler. Hiçbir uç başarılı olup veri yazamaz/okuyamaz.
const FAKE_ID = "00000000-0000-4000-8000-000000000000";

test.describe("g) Güvenlik (anonim)", () => {
  test("/admin girişe yönlenir", async ({ request }) => {
    const res = await request.get("/admin", { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(res.status());
    expect(res.headers()["location"]).toMatch(/\/giris\?tab=yonetici/);
  });

  test("/admin tarayıcıda giriş sayfasına düşer, yönetici içeriği görünmez", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/giris/);
    await expect(page.getByText("Ana Sayfayı Düzenle")).toHaveCount(0);
  });

  const adminCalls: { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string }[] = [
    { method: "GET", path: "/api/admin/orders" },
    { method: "GET", path: "/api/admin/sessions" },
    { method: "GET", path: "/api/admin/users" },
    { method: "POST", path: "/api/admin/product" },
    { method: "POST", path: "/api/admin/categories" },
    { method: "PUT", path: "/api/admin/homepage" },
    { method: "POST", path: "/api/admin/coupons" },
    { method: "POST", path: "/api/admin/undo" },
    { method: "POST", path: "/api/admin/order-status" },
    { method: "GET", path: "/api/seed" },
  ];
  for (const c of adminCalls) {
    test(`${c.method} ${c.path} anonim → 401/403`, async ({ request }) => {
      const res = await request.fetch(c.path, { method: c.method, data: c.method === "GET" ? undefined : {}, maxRedirects: 0 });
      expect([401, 403]).toContain(res.status());
      expect(await res.text()).not.toMatch(/"success":\s*true/);
    });
  }

  test("başkasının dekontuna anonim erişim reddedilir", async ({ request }) => {
    const res = await request.get(`/api/receipts/${FAKE_ID}`);
    expect([401, 403]).toContain(res.status());
  });

  test("başkasının faturasına anonim erişim reddedilir", async ({ request }) => {
    const res = await request.get(`/api/orders/${FAKE_ID}/invoice`);
    expect([401, 403]).toContain(res.status());
  });

  test("anonim 'siparişlerim' faturalı sipariş listesi boş döner", async ({ request }) => {
    const res = await request.get("/api/orders/invoices");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ orderIds: [] });
  });

  test("kimlik gerektiren uçlar anonim isteğe kullanıcı verisi vermez", async ({ request }) => {
    const me = await request.get("/api/auth/me?orders=1");
    expect(me.status()).toBe(200);
    const body = (await me.json()) as { user: unknown; admin: boolean };
    expect(body.user).toBeNull();
    expect(body.admin).toBe(false);
  });

  test("zamanlanmış görev uçları CRON_SECRET boşken kapalı (401)", async ({ request }) => {
    for (const p of ["/api/cron/reminders", "/api/cron/sync-shipments"]) {
      const res = await request.get(p);
      expect(res.status(), p).toBe(401);
    }
  });
});
