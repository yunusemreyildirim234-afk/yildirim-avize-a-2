import type { Page, Locator } from "@playwright/test";
import { test, expect, lockNetwork } from "../../fixtures";
import { autoDialogs, cleanupE2eProducts, createProductViaForm, openAdmin, png, uniq } from "../../admin-helpers";
import { productIdByTitle } from "../../db";

const PREFIX = "E2E Foto Geçişi";

/** Gerçek dokunmatik yatay sürükleme (Chromium CDP touch olayları): scroll-snap'i yerel olarak sürer. */
async function touchSwipe(page: Page, target: Locator, dx: number) {
  const box = (await target.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const pt = (dx2: number) => [{ x: x + dx2, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(0) });
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt((dx * i) / steps) });
    await target.page().waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

const cardOf = (page: Page, id: string) => page.locator("div.group", { has: page.locator(`a[href="/urun/${id}"]`) }).first();

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

test.describe("Admin: çok fotoğraflı ürün — kart ve ürün sayfası geçişi", () => {
  test.afterAll(async ({ request }) => {
    await cleanupE2eProducts(request, PREFIX);
  });

  test("kart + ürün sayfası: ok, kaydırma, klavye, sayaç, Büyüt, tek fotoğraf", async ({ page, browser, baseURL }) => {
    test.setTimeout(240_000);
    const multi = `${PREFIX} Çoklu ${uniq()}`;
    const single = `${PREFIX} Tekli ${uniq()}`;
    const dialogs = autoDialogs(page);

    await openAdmin(page);
    await createProductViaForm(page, {
      title: multi,
      category: "Kristal",
      photos: [png(220, 20, 20, "g1.png"), png(20, 160, 40, "g2.png"), png(20, 20, 220, "g3.png")],
    });
    await expect.poll(() => dialogs.join("|"), { timeout: 60_000 }).toContain("vitrine eklendi");
    dialogs.length = 0;
    await createProductViaForm(page, { title: single, category: "Kristal", photos: [png(200, 100, 20, "t1.png")] });
    await expect.poll(() => dialogs.join("|"), { timeout: 60_000 }).toContain("vitrine eklendi");
    const multiId = (await productIdByTitle(multi))!;
    const singleId = (await productIdByTitle(single))!;
    expect(multiId && singleId).toBeTruthy();

    // ---- Masaüstü: kart ----
    await test.step("masaüstü kart: ok fotoğrafı değiştirir, sayfaya GİTMEZ; kartın başka yeri gider", async () => {
      await page.goto(`/arama?q=${encodeURIComponent(multi)}`);
      const card = cardOf(page, multiId);
      await expect(card).toBeVisible();
      const track = card.getByTestId("card-track");
      await expect(card.locator("img")).toHaveCount(1); // etkileşimden önce yalnızca kapak istenir
      await card.hover();
      const next = card.getByRole("button", { name: "Sonraki fotoğraf" });
      await expect(next).toBeVisible();
      await next.click();
      expect(page.url()).toContain("/arama");
      await expect.poll(() => track.evaluate((el) => Math.round(el.scrollLeft / el.clientWidth))).toBe(1);
      await expect(card.getByRole("button", { name: "Önceki fotoğraf" })).toBeVisible();
      expect(page.url()).toContain("/arama");
      // kalp ve + hâlâ çalışır, sayfa değişmez
      await card.getByRole("button", { name: /Favorilere ekle|Favorilerden çıkar/ }).click();
      expect(page.url()).toContain("/arama");
      await card.getByRole("heading", { level: 3 }).click();
      await expect(page).toHaveURL(new RegExp(`/urun/${multiId}`));
    });

    await test.step("tek fotoğraflı kartta ok, nokta ve kaydırıcı yok", async () => {
      await page.goto(`/arama?q=${encodeURIComponent(single)}`);
      const card = cardOf(page, singleId);
      await expect(card).toBeVisible();
      await expect(card.getByTestId("card-track")).toHaveCount(0);
      await expect(card.getByTestId("card-dots")).toHaveCount(0);
      await expect(card.getByRole("button", { name: /fotoğraf/ })).toHaveCount(0);
    });

    // ---- Masaüstü: ürün sayfası ----
    await test.step("ürün sayfası: ok, klavye, sayaç, küçük resim senkronu, Büyüt gezinmesi", async () => {
      await page.goto(`/urun/${multiId}`);
      const counter = page.getByTestId("gallery-counter");
      await expect(counter).toHaveText("1 / 3");
      const tabs = page.getByRole("tablist", { name: "Ürün fotoğrafları" }).getByRole("tab");
      await expect(tabs).toHaveCount(3);
      await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
      await page.getByTestId("gallery-track").hover();
      await page.getByTestId("gallery-track").locator("xpath=..").getByRole("button", { name: "Sonraki fotoğraf" }).click();
      await expect(counter).toHaveText("2 / 3");
      await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
      await page.getByTestId("gallery-track").focus();
      await page.keyboard.press("ArrowRight");
      await expect(counter).toHaveText("3 / 3");
      await page.keyboard.press("ArrowLeft");
      await expect(counter).toHaveText("2 / 3");
      await tabs.nth(0).click();
      await expect(counter).toHaveText("1 / 3");
      await expect(page.getByTestId("gallery-track")).toBeVisible();

      await page.getByRole("button", { name: "Görseli büyüt" }).first().click();
      const dlg = page.getByRole("dialog", { name: multi });
      await expect(dlg.getByTestId("lightbox-counter")).toHaveText("1 / 3");
      await page.keyboard.press("ArrowRight");
      await expect(dlg.getByTestId("lightbox-counter")).toHaveText("2 / 3");
      await dlg.getByRole("button", { name: "Sonraki fotoğraf" }).click();
      await expect(dlg.getByTestId("lightbox-counter")).toHaveText("3 / 3");
      await page.keyboard.press("Escape");
      await expect(dlg).toHaveCount(0);
      await expect(counter).toHaveText("3 / 3");
    });

    await test.step("tek fotoğraflı ürün sayfasında ok ve sayaç yok", async () => {
      await page.goto(`/urun/${singleId}`);
      await expect(page.getByTestId("gallery-counter")).toHaveCount(0);
      await expect(page.getByTestId("gallery-track").locator("xpath=..").getByRole("button", { name: "Sonraki fotoğraf" })).toHaveCount(0);
    });

    // ---- Mobil (390 px, dokunmatik) ----
    const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await lockNetwork(ctx, baseURL!);
    const m = await ctx.newPage();
    try {
      await test.step("mobil kart: dokunmatik kaydırma fotoğrafı değiştirir, sayfa geçişi olmaz; yatay taşma yok", async () => {
        await m.goto(`/arama?q=${encodeURIComponent(multi)}`);
        const card = cardOf(m, multiId);
        await expect(card).toBeVisible();
        const track = card.getByTestId("card-track");
        await expect(card.getByRole("button", { name: "Sonraki fotoğraf" })).toBeHidden(); // mobilde ok yok
        await touchSwipe(m, track, -250);
        await expect.poll(() => track.evaluate((el) => Math.round(el.scrollLeft / el.clientWidth))).toBe(1);
        expect(m.url()).toContain("/arama");
        await noHorizontalOverflow(m);
        await card.getByRole("heading", { level: 3 }).click();
        await expect(m).toHaveURL(new RegExp(`/urun/${multiId}`));
      });

      await test.step("mobil ürün sayfası: kaydırma sayaç ve küçük resmi günceller", async () => {
        await m.goto(`/urun/${multiId}`);
        const counter = m.getByTestId("gallery-counter");
        await expect(counter).toHaveText("1 / 3");
        await touchSwipe(m, m.getByTestId("gallery-track"), -250);
        await expect(counter).toHaveText("2 / 3");
        await expect(m.getByRole("tablist", { name: "Ürün fotoğrafları" }).getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
        expect(m.url()).toContain(`/urun/${multiId}`);
        await noHorizontalOverflow(m);
      });
    } finally {
      await ctx.close();
    }
  });
});
