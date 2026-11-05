import { test, expect } from "../../fixtures";
import { openAdmin } from "../../admin-helpers";

const ANON = { cookies: [], origins: [] };

test.describe("Admin giriş / çıkış", () => {
  test.describe("anonim", () => {
    test.use({ storageState: ANON });

    test("anonim /admin → yönetici girişine yönlenir", async ({ page }) => {
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/giris\?tab=yonetici/);
      await expect(page.locator("#admin-user")).toBeVisible();
    });

    test("anonim /api/admin/* → 401 (veri sızmaz)", async ({ request }) => {
      const res = await request.get("/api/admin/activity");
      expect(res.status()).toBe(401);
    });

    test("yanlış parola ile girilmez", async ({ page, context }) => {
      await page.goto("/giris?tab=yonetici");
      await page.locator("#admin-user").fill(process.env.E2E_ADMIN_USER!);
      await page.locator("#admin-pass").fill("yanlis-parola-" + Date.now());
      await page.getByRole("button", { name: "Yönetim Paneline Gir" }).click();
      await expect(page.locator("p[role=alert]")).toContainText("hatalı");
      await expect(page).toHaveURL(/\/giris/);
      expect((await context.cookies()).some((c) => c.name === "ya_admin")).toBe(false);
      const res = await page.goto("/admin");
      expect(res!.url()).toContain("/giris");
    });
  });

  test("geçerli oturumla /admin açılır, GTM isteği yok", async ({ page, gtmRequests, consoleErrors }) => {
    await openAdmin(page);
    await expect(page).toHaveURL(/\/admin$/);
    await page.waitForLoadState("networkidle");
    expect(gtmRequests.map((r) => r.url()), "oturumlu /admin'de GTM/GA isteği olmamalı").toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("admin bölümleri açılıp kapanır, konsol hatasız", async ({ page, consoleErrors, serverErrors }) => {
    await openAdmin(page);
    const toggles = page.locator("section[id] > button[aria-expanded]");
    const n = await toggles.count();
    expect(n).toBeGreaterThan(3);
    for (let i = 0; i < n; i++) await toggles.nth(i).click();
    await page.waitForLoadState("networkidle");
    expect(consoleErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });
});

test.describe("çıkış", () => {
  test.use({ storageState: ANON });

  test("giriş yap → çıkış yap → /admin yeniden girişe yönlenir", async ({ page }) => {
    await page.goto("/giris?tab=yonetici");
    await page.locator("#admin-user").fill(process.env.E2E_ADMIN_USER!);
    await page.locator("#admin-pass").fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Yönetim Paneline Gir" }).click();
    await page.waitForURL("**/admin");
    await page.goto("/");
    // Menü hover'da açılır, tıklamada ters döner (hover+click menüyü kapatabilir): fare kullanmadan odak + Enter ile aç.
    // "Çıkış Yap" öğesi oturum bilgisi istemciye yüklenince gelir; açık kalan menüde bu beklenir, toPass yeniden dener.
    const trigger = page.getByRole("button", { name: "Hesap menüsünü aç" });
    const logout = page.getByRole("menuitem", { name: "Çıkış Yap" });
    await expect(async () => {
      await trigger.focus();
      if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.press("Enter");
      await expect(logout).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });
    await logout.click();
    await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "ya_admin")).toBe(false);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/giris\?tab=yonetici/);
  });
});
