import crypto from "node:crypto";
import { test, expect } from "../../fixtures";
import { openAdmin, uniq } from "../../admin-helpers";
import { exec } from "../../db";

// Gerçek bir yönetici bildirimi (sipariş/soru) e-posta ya da sipariş akışı gerektirdiği için burada üretilmez.
// Bunun yerine e2e veritabanına "E2E " başlıklı SENTETİK bir yönetici bildirimi eklenir (userId/userEmail boş = yönetici bildirimi) ve sonda silinir.
// Test edilen şey bildirim ÜRETİMİ değil, zil → bağlantı → #hash → AdminSection açılması zinciridir.
test.describe("Admin bildirim bağlantısı", () => {
  const id = crypto.randomUUID();
  const title = `E2E Test Bildirimi ${uniq()}`;

  test.beforeAll(async () => {
    await exec(
      `insert into "Notification" (id, "userId", "userEmail", title, message, type, link, read, "createdAt") values ($1, null, null, $2, 'E2E sentetik bildirim', 'QUESTION', '/admin#mesajlar', false, now())`,
      [id, title]
    );
  });
  test.afterAll(async () => {
    await exec(`delete from "Notification" where id = $1 or title like 'E2E Test Bildirimi%'`, [id]);
  });

  test("zildeki bağlantı (/admin sayfasında) ilgili bölümü açar", async ({ page }) => {
    await openAdmin(page);
    await expect(page.locator("#mesajlar > button")).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: /^Bildirimler/ }).click();
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page.locator("#mesajlar > button")).toHaveAttribute("aria-expanded", "true");
    expect(page.url()).toContain("#mesajlar");
  });

  test("başka sayfadan zil bağlantısı /admin#mesajlar'ı açar ve bölümü genişletir", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Bildirimler/ }).click();
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await page.waitForURL(/\/admin#mesajlar/);
    await expect(page.locator("#mesajlar > button")).toHaveAttribute("aria-expanded", "true", { timeout: 30_000 });
  });
});
