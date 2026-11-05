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
    for (const width of [320, 360, 390, 480, 640, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      const sep = page.getByText("veya e-posta ile", { exact: true });
      await expect(sep).toBeVisible();
      const info = await sep.evaluate((el) => {
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
        return { lines: Math.round(el.getBoundingClientRect().height / lh), overflow: document.documentElement.scrollWidth - window.innerWidth };
      });
      const lines = await sep.evaluate((el) => {
        const w = (e: Element | null) => (e ? e.getBoundingClientRect().width : 0);
        return { left: w(el.previousElementSibling), right: w(el.nextElementSibling) };
      });
      expect(lines.left, `sol çizgi görünür @${width}`).toBeGreaterThan(8);
      expect(lines.right, `sağ çizgi görünür @${width}`).toBeGreaterThan(8);
      expect(Math.abs(lines.left - lines.right), `çizgiler simetrik @${width}`).toBeLessThanOrEqual(2);
      expect(info.lines, `satır sayısı @${width}`).toBe(1);
      expect(info.overflow, `yatay taşma @${width}`).toBeLessThanOrEqual(0);
    }
  });
});
