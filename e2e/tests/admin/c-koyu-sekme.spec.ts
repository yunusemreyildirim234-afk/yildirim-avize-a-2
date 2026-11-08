import type { Page } from "@playwright/test";
import { test, expect } from "../../fixtures";
import { expandPanel, openAdmin } from "../../admin-helpers";
import { exec, rows } from "../../db";

// Toplu işlem çubuğu sekmeleri (Stok, İsim, ..., Aktif/Pasif): açık ve koyu temada, seçili ve seçili olmayan hâlde WCAG AA (>= 4.5:1).
// Geçiş animasyonu (transition-colors) bitmeden ölçülmez. Veri "E2E Sekme" önekli, sonda silinir. E2E_EKRAN=1 ile görüntü de alınır.
const TITLE = "E2E Sekme Avize";
let pid = "";

// Yazı rengi ile (şeffaf değilse) zemin rengi arasındaki kontrast; renkler canvas ile sRGB'ye çevrilir (oklch dahil).
async function contrast(page: Page, label: string) {
  return page.evaluate((name) => {
    const btn = [...document.querySelectorAll("#admin-selection-detail button")].find((b) => b.textContent?.trim() === name) as HTMLElement | undefined;
    if (!btn) return null;
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const rgb = (c: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const cs = getComputedStyle(btn);
    const [a, b] = [lum(rgb(cs.color)), lum(rgb(cs.backgroundColor))];
    return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), fg: cs.color, bg: cs.backgroundColor };
  }, label);
}

test.describe.configure({ mode: "serial" });

test.describe("Toplu işlem sekmeleri kontrast", () => {
  test.beforeAll(async () => {
    const [p] = await rows<{ id: string }>(`insert into "Product" (id, title, category, "basePrice", active, "updatedAt") values (gen_random_uuid()::text, $1, 'E2E Sekme Kat', 1000, true, now()) returning id`, [TITLE]);
    pid = p.id;
    await exec(`insert into "ProductVariation" (id, "productId", "variationType", "variationValue", stock) values (gen_random_uuid()::text, $1, 'Renk', 'Altın', 5)`, [pid]);
  });
  test.afterAll(async () => {
    await exec(`delete from "Product" where title like 'E2E Sekme%'`).catch(() => {});
  });

  for (const scheme of ["light", "dark"] as const) {
    for (const [w, h] of [[1280, 900], [390, 844]]) {
      test(`sekmeler okunur: ${scheme} ${w}px`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: w, height: h });
        await page.emulateMedia({ colorScheme: scheme });
        await openAdmin(page);
        await expandPanel(page, /^Tüm Ürünler/);
        await page.getByLabel("Ürün ismi, stok kodu veya model kodu ile ara").fill(TITLE);
        await page.getByLabel(`${TITLE} seç`).check();
        await page.locator('button[aria-controls="admin-selection-detail"]').click();
        const detail = page.locator("#admin-selection-detail");
        const tabs = (await detail.locator("button.rounded-full.shrink-0").allTextContents()).map((t) => t.trim());
        expect(tabs.length).toBeGreaterThanOrEqual(6);
        expect(tabs).toContain("Stok");
        expect(tabs).toContain("Aktif/Pasif");
        for (const t of tabs) {
          await detail.getByRole("button", { name: t, exact: true }).click();
          await page.waitForTimeout(450); // transition-colors bitsin
          const sel = await contrast(page, t);
          expect(sel?.ratio ?? 0, `${scheme} ${w}: seçili "${t}" ${sel?.fg} / ${sel?.bg}`).toBeGreaterThanOrEqual(4.5);
          for (const o of tabs.filter((x) => x !== t)) {
            const un = await contrast(page, o);
            expect(un?.ratio ?? 0, `${scheme} ${w}: seçili olmayan "${o}" ${un?.fg} / ${un?.bg}`).toBeGreaterThanOrEqual(4.5);
          }
          if (process.env.E2E_EKRAN) await detail.screenshot({ path: `test-results/ekran-yeni/sekme-${scheme}-${w}-${t.replace(/\W+/g, "_")}.png` });
        }
      });
    }
  }
});
