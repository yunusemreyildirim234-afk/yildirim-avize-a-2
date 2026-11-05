import { test, expect, openOk } from "../fixtures";

const KEY = "ya-cerez-onayi";

test.describe("h) Çerez ve GTM", () => {
  test("onay verilmeden GTM isteği yok; varsayılan izinler 'denied'", async ({ page, gtmRequests }) => {
    await openOk(page, "/");
    await expect(page.getByRole("dialog", { name: "Çerez ve KVKK bilgilendirmesi" })).toBeVisible();
    // Consent Mode varsayılanı dataLayer'a yazılmış olmalı (GTM yüklenmeden)
    await page.waitForFunction(() => Array.isArray((window as unknown as { dataLayer?: unknown[] }).dataLayer));
    await page.waitForLoadState("networkidle");
    expect(gtmRequests.map((r) => r.url())).toEqual([]);
    const denied = await page.evaluate(() => {
      const dl = ((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []) as ArrayLike<unknown>[];
      const first = dl.map((e) => Array.from(e as ArrayLike<unknown>)).find((a) => a[0] === "consent" && a[1] === "default");
      return first ? (first[2] as Record<string, string>) : null;
    });
    expect(denied?.analytics_storage).toBe("denied");
    expect(denied?.ad_storage).toBe("denied");
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
  });

  test('"Kabul Et" sonrası GTM isteği denenir ve localStorage yazılır', async ({ page, gtmRequests }) => {
    await openOk(page, "/");
    await page.getByRole("button", { name: "Kabul Et" }).click();
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), KEY)).toBe("accepted");
    await expect(page.getByRole("dialog", { name: "Çerez ve KVKK bilgilendirmesi" })).toBeHidden();
    // İstek denenir (yanıt test tarafından yerel taslakla karşılanır; internete gitmez)
    await expect.poll(() => gtmRequests.map((r) => r.url()).find((u) => u.includes("googletagmanager.com/gtm.js")), { timeout: 15_000 }).toContain("id=GTM-TEST000");
  });

  test('"Reddet" sonrası GTM isteği yok ve tercih saklanır', async ({ page, gtmRequests }) => {
    await openOk(page, "/");
    await page.getByRole("button", { name: "Reddet" }).click();
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), KEY)).toBe("rejected");
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("dialog", { name: "Çerez ve KVKK bilgilendirmesi" })).toBeHidden();
    expect(gtmRequests.map((r) => r.url())).toEqual([]);
  });

  test("kayıtlı onay varsa sonraki sayfa yüklemesinde GTM yüklenir ve çubuk çıkmaz", async ({ page, gtmRequests }) => {
    await page.addInitScript((k) => localStorage.setItem(k, "accepted"), KEY);
    await openOk(page, "/kategori/tum");
    await expect(page.getByRole("dialog", { name: "Çerez ve KVKK bilgilendirmesi" })).toBeHidden();
    await expect.poll(() => gtmRequests.length, { timeout: 15_000 }).toBeGreaterThan(0);
  });

  test("/admin (anonim): GTM isteği hiç yapılmaz", async ({ page, gtmRequests }) => {
    // Onay verilmiş olsa bile yönetici yoluna gidiş GTM isteği doğurmaz (anonim istek girişe yönlenir).
    // Yönetici oturumuyla /admin'in kendisinde GTM'nin yüklenmediği Aşama 2'de (oturumlu testler) doğrulanır.
    await page.addInitScript((k) => localStorage.setItem(k, "accepted"), KEY);
    const res = await page.request.get("/admin", { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(res.status());
    expect(gtmRequests.map((r) => r.url())).toEqual([]);
  });
});
