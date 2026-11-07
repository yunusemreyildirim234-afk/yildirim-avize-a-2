import type { Page } from "@playwright/test";
import { test, expect, openOk } from "../fixtures";

/** Dokunma hedefi ölçümü (yalnızca mobil proje): etkileşimli öğelerin dokunulabilir alanı >= 40 px. Etiket içindeki onay kutusu için etiket alanı sayılır. */
const MIN = 40;

interface Hit { tag: string; name: string; w: number; h: number }

async function smallTargets(page: Page, rootSel: string): Promise<Hit[]> {
  return page.evaluate(
    ({ rootSel, MIN }) => {
      const root = document.querySelector(rootSel);
      if (!root) return [];
      const out: Hit[] = [];
      for (const el of root.querySelectorAll<HTMLElement>('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"]')) {
        if (el.closest('[aria-hidden="true"]') && el.tagName !== "INPUT") continue; // yalnızca gösterge (ör. fotoğraf noktaları)
        const target = el instanceof HTMLInputElement && el.closest("label") ? (el.closest("label") as HTMLElement) : el;
        const cs = getComputedStyle(target);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const r = target.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // sr-only (1 px) öğeler görünmez sayılır
        if (r.width <= 1 && r.height <= 1) continue;
        // ::after ile genişletilmiş dokunma alanı (toast kapat düğmeleri)
        const after = getComputedStyle(target, "::after");
        const inset = after.position === "absolute" && after.content !== "none" ? Math.abs(parseFloat(after.top) || 0) : 0;
        const w = r.width + 2 * inset;
        const h = r.height + 2 * inset;
        // Satır içi metin bağlantıları (paragraf içinde) dışarıda tutulmaz: yalnızca boyut ölçülür
        if (w < MIN - 0.5 || h < MIN - 0.5) {
          out.push({ tag: target.tagName.toLowerCase(), name: (target.getAttribute("aria-label") || target.textContent || "").trim().slice(0, 40), w: Math.round(w), h: Math.round(h) });
        }
      }
      return out;
    },
    { rootSel, MIN }
  );
}

test.describe("n) Mobil liste: dokunma hedefleri ve düzen", () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== "mobile", "yalnızca mobil proje");
  });

  for (const path of ["/kategori/tum", "/arama?q=avize"]) {
    test(`${path}: etkileşimli öğeler >= ${MIN} px, yatay taşma yok, sayfalama tek satır`, async ({ page }) => {
      await openOk(page, path);
      await expect(page.getByTestId("urun-sayisi")).toBeVisible();
      const hits = await smallTargets(page, "main");
      console.log(`[OLCUM] ${path} küçük hedefler (main):`, JSON.stringify(hits));
      expect(hits, "40 px'ten küçük dokunma hedefleri").toEqual([]);
      const m = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
      expect(m.doc, "yatay taşma").toBeLessThanOrEqual(m.win);

      // Sayfalama: Önceki / sayfa bilgisi / Sonraki aynı satırda
      const nav = page.getByRole("navigation", { name: "Sayfalama (alt)" });
      if (await nav.count()) {
        const [prev, info, next] = await Promise.all([
          nav.locator("[aria-disabled], a[rel='prev']").first().boundingBox(),
          nav.getByText(/^Sayfa \d+ \/ \d+$/).boundingBox(),
          nav.locator("a[rel='next'], [aria-disabled]").last().boundingBox(),
        ]);
        expect(prev && info && next).toBeTruthy();
        const cy = (b: { y: number; height: number }) => b.y + b.height / 2;
        expect(Math.abs(cy(prev!) - cy(info!)), "Önceki ve sayfa bilgisi aynı satırda").toBeLessThan(6);
        expect(Math.abs(cy(next!) - cy(info!)), "Sonraki ve sayfa bilgisi aynı satırda").toBeLessThan(6);
      }
    });
  }

  test("/kategori/tum: filtre çekmecesi öğeleri >= 40 px", async ({ page }) => {
    await openOk(page, "/kategori/tum");
    await page.getByTestId("filtre-ac").click();
    const dlg = page.getByRole("dialog", { name: "Filtrele ve Sırala" });
    await expect(dlg).toBeVisible();
    const hits = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      if (!d) return [];
      const out: Hit[] = [];
      for (const el of d.querySelectorAll<HTMLElement>('a[href], button, input:not([type="hidden"]), select')) {
        const t = el instanceof HTMLInputElement && el.closest("label") ? (el.closest("label") as HTMLElement) : el;
        const r = t.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < 39.5 || r.height < 39.5) out.push({ tag: t.tagName.toLowerCase(), name: (t.getAttribute("aria-label") || t.textContent || "").trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) });
      }
      return out;
    });
    console.log("[OLCUM] filtre çekmecesi küçük hedefler:", JSON.stringify(hits));
    expect(hits).toEqual([]);
  });

  test("/kategori/tum: başlık ile 'Filtrele ve Sırala' düğmesi arası dar", async ({ page }) => {
    await openOk(page, "/kategori/tum");
    const h1 = (await page.locator("main h1").boundingBox())!;
    const btn = (await page.getByTestId("filtre-ac").boundingBox())!;
    const lead = (await page.locator("main section").first().boundingBox())!;
    console.log(`[OLCUM] h1 alt=${Math.round(h1.y + h1.height)} düğme üst=${Math.round(btn.y)} bölüm alt=${Math.round(lead.y + lead.height)}`);
    expect(btn.y - (lead.y + lead.height), "başlık bölümü ile düğme arası").toBeLessThanOrEqual(40);
  });
});
