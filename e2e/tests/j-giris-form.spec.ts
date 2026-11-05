import { test, expect, openOk } from "../fixtures";

const fontPx = (loc: import("@playwright/test").Locator) => loc.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

test.describe("j) Giriş/kayıt formu: mobil alan boyutu ve ayırıcı", () => {
  test("giriş, kayıt ve şifre sıfırlama alanları dar ekranda >=16 px, sm ve üstünde 12 px", async ({ page }) => {
    await openOk(page, "/giris");
    for (const [width, expected] of [[390, 16], [640, 12]] as const) {
      await page.setViewportSize({ width, height: 800 });
      const check = async (label: string) => {
        const inputs = page.locator("form input:visible");
        const n = await inputs.count();
        expect(n, `${label}: görünür alan yok`).toBeGreaterThan(0);
        for (let i = 0; i < n; i++) {
          const px = await fontPx(inputs.nth(i));
          if (expected === 16) expect(px, `${label} #${i} @${width}`).toBeGreaterThanOrEqual(16);
          else expect(px, `${label} #${i} @${width}`).toBe(12);
        }
      };
      await check("giriş");
      await page.getByRole("button", { name: "Kayıt Ol" }).click();
      await check("kayıt");
      await page.getByRole("button", { name: "Giriş Yap" }).first().click();
      await page.getByRole("button", { name: "Şifremi Unuttum?" }).click();
      await check("şifre sıfırlama");
      await page.getByRole("button", { name: /Girişe dön/ }).click();
    }
  });

  test("'veya e-posta ile' ayırıcısı 320-640 px arasında tek satır, yatay taşma yok", async ({ page }) => {
    await openOk(page, "/giris");
    for (const width of [320, 360, 390, 480, 640]) {
      await page.setViewportSize({ width, height: 800 });
      const sep = page.getByText("veya e-posta ile", { exact: true });
      await expect(sep).toBeVisible();
      const info = await sep.evaluate((el) => {
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
        return { lines: Math.round(el.getBoundingClientRect().height / lh), overflow: document.documentElement.scrollWidth - window.innerWidth };
      });
      expect(info.lines, `satır sayısı @${width}`).toBe(1);
      expect(info.overflow, `yatay taşma @${width}`).toBeLessThanOrEqual(0);
    }
  });
});
