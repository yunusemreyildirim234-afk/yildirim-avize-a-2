import fs from "node:fs";
import path from "node:path";
import { test as setup, expect } from "@playwright/test";

// Gerçek giriş akışı (/giris?tab=yonetici → /api/auth/admin). Kimlik bilgisi bu çalıştırmaya özel rastgele değerdir (playwright.config.ts).
// Oturum bir kez alınır, storageState olarak kaydedilir; testler yeniden giriş yapmaz.
const STATE = path.join(__dirname, "..", "..", ".auth", "admin.json");

setup("yönetici girişi", async ({ page }) => {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  await page.goto("/giris?tab=yonetici");
  await page.locator("#admin-user").fill(process.env.E2E_ADMIN_USER!);
  await page.locator("#admin-pass").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Yönetim Paneline Gir" }).click();
  await page.waitForURL("**/admin");
  // Neon soğuk başlangıcında ilk /admin isteği veritabanı zaman aşımıyla hata sayfası verebilir (bulgu olarak raporlanır); birkaç kez yeniden dene.
  const h1 = page.getByRole("heading", { level: 1 });
  for (let i = 0; i < 5 && !/Operasyon/.test((await h1.first().textContent()) ?? ""); i++) {
    await page.waitForTimeout(3000);
    await page.goto("/admin");
  }
  await expect(h1).toContainText("Operasyon");
  await page.context().storageState({ path: STATE });
});
