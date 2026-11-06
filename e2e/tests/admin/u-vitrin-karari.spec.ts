import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect } from "../../fixtures";
import { autoDialogs, expandPanel, findInProductList, openAdmin, refreshStorefront } from "../../admin-helpers";
import { exec, rows } from "../../db";

// F (vitrin sıra kararlılığı), G (Çok Satanlar'dan gizleme), H (Öne Çıkanlar otomatik→elle uyarısı). Yalnızca e2e veritabanı; ayar/bayraklar sonda geri yüklenir.
type Cfg = Record<string, unknown> | null;
const POLL = { timeout: 40_000, intervals: [1000, 2000, 3000] };
const readCfg = async (): Promise<Cfg> => (await rows<{ cfg: Cfg }>(`select "homepageConfig" as cfg from "SiteConfig" where id = 1`))[0]?.cfg ?? null;
const SAVE_BTN = "xpath=//span[contains(.,'Kaydedince ana sayfada hemen')]/preceding-sibling::button";

/** Ana sayfada başlığa göre bölümdeki ürün adresleri (belge sırasıyla, tekrarsız). */
async function sectionHrefs(page: Page, heading: string): Promise<string[]> {
  await page.goto("/");
  return page.evaluate((h) => {
    const el = [...document.querySelectorAll("h2")].find((x) => x.textContent?.trim() === h);
    let node: HTMLElement | null = el?.parentElement ?? null;
    while (node && node.querySelectorAll("a[href^='/urun/']").length === 0) node = node.parentElement;
    return [...new Set([...(node?.querySelectorAll("a[href^='/urun/']") ?? [])].map((a) => a.getAttribute("href") as string))];
  }, heading);
}

async function restoreCfg(request: APIRequestContext, original: Cfg, anyId: string) {
  await exec(`update "SiteConfig" set "homepageConfig" = $1::jsonb where id = 1`, [original === null ? null : JSON.stringify(original)]);
  await refreshStorefront(request, anyId);
}

test.describe("F: vitrin sırası updatedAt'tan bağımsız", () => {
  test("ürün güncellenince Öne Çıkanlar sırası değişmez", async ({ page, request }) => {
    const before = await sectionHrefs(page, "Öne Çıkan Ürünler");
    test.skip(before.length < 2, "vitrinde en az 2 ürün gerekir");
    const last = before[before.length - 1].replace("/urun/", "");
    const stamp = async () => (await rows<{ t: Date }>(`select "updatedAt" as t from "Product" where id = $1`, [last]))[0].t.getTime();
    const was = await stamp();
    await page.waitForTimeout(1100);
    await refreshStorefront(request, last); // aynı başlıkla PATCH: updatedAt güncellenir + vitrin yenilenir
    expect(await stamp(), "updatedAt gerçekten yenilendi").toBeGreaterThan(was);
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(2500);
      expect(await sectionHrefs(page, "Öne Çıkan Ürünler"), `deneme ${i + 1}`).toEqual(before);
    }
  });
});

test.describe("G: Çok Satanlar'dan gizleme", () => {
  test("gizle → listede yok (ürün/arama etkilenmez) → yeniden göster → döner", async ({ page, request }) => {
    const original = await readCfg();
    autoDialogs(page);
    const best = await sectionHrefs(page, "Çok Satanlar");
    test.skip(best.length === 0, "Çok Satanlar boş");
    const id = best[0].replace("/urun/", "");
    const [prod] = await rows<{ title: string; modelCode: string | null }>(`select title, "modelCode" from "Product" where id = $1`, [id]);
    try {
      await test.step("admin: Çok Satanlar bölümünden gizle", async () => {
        await openAdmin(page);
        await expandPanel(page, /Ana Sayfayı Düzenle/);
        const btn = page.locator("#hp-bestsellers-h");
        await btn.click();
        await expect(btn).toHaveAttribute("aria-expanded", "true");
        await page.getByLabel("Çok Satanlar'da gizlenecek ürünü ara").fill(prod.modelCode ?? prod.title);
        await page.locator("#hp-bestsellers-panel ul button", { hasText: prod.title }).first().click();
        await expect(page.getByRole("list", { name: "Çok Satanlar'da gizlenen ürünler" })).toContainText(prod.title);
        const [res] = await Promise.all([
          page.waitForResponse((r) => r.url().includes("/api/admin/homepage") && r.request().method() === "PUT", { timeout: 60_000 }),
          page.locator(SAVE_BTN).click(),
        ]);
        expect(res.status()).toBe(200);
        expect(((await readCfg())?.hiddenBestSellers as string[]) ?? []).toContain(id);
      });

      await test.step("ana sayfa ve 'Daha fazla göster' listesinde yok", async () => {
        await expect.poll(async () => (await sectionHrefs(page, "Çok Satanlar")).includes(`/urun/${id}`), POLL).toBe(false);
        const more = page.locator("section", { has: page.getByRole("heading", { name: "Çok Satanlar" }) }).getByRole("button", { name: /Daha fazla göster/ });
        if (await more.count()) {
          await more.click();
          await page.waitForTimeout(3000);
        }
        const after = await page.evaluate(() => [...document.querySelectorAll("section.keep-theme a[href^='/urun/']")].map((a) => a.getAttribute("href")));
        expect(after).not.toContain(`/urun/${id}`);
      });

      await test.step("ürün sayfası ve arama etkilenmez", async () => {
        expect((await request.get(`/urun/${id}`)).status()).toBe(200);
        const body = (await (await request.get(`/api/search?q=${encodeURIComponent(prod.title)}`)).json()) as { products: { id: string }[] };
        expect(body.products.map((p) => p.id)).toContain(id);
      });

      await test.step("admin: yeniden göster → listeye döner", async () => {
        await openAdmin(page);
        await expandPanel(page, /Ana Sayfayı Düzenle/);
        await page.locator("#hp-bestsellers-h").click();
        await page.locator("#hp-bestsellers-panel").getByRole("button", { name: "Yeniden göster" }).first().click();
        const [res] = await Promise.all([
          page.waitForResponse((r) => r.url().includes("/api/admin/homepage") && r.request().method() === "PUT", { timeout: 60_000 }),
          page.locator(SAVE_BTN).click(),
        ]);
        expect(res.status()).toBe(200);
        expect(((await readCfg())?.hiddenBestSellers as string[] | undefined) ?? []).not.toContain(id);
        await expect.poll(async () => (await sectionHrefs(page, "Çok Satanlar")).includes(`/urun/${id}`), POLL).toBe(true);
      });
    } finally {
      await restoreCfg(request, original, id);
    }
  });
});

test.use({ actionTimeout: 20_000 });
test.describe("H: Öne Çıkanlar otomatik → elle uyarısı", () => {
  test("otomatik modda 'çıkar' uyarı verir, vazgeçince değişmez; elle modda uyarı yok", async ({ page, request }) => {
    const flagged = await rows<{ id: string }>(`select id from "Product" where "isFeatured" = true`);
    const [prod] = await rows<{ id: string; title: string }>(`select id, title from "Product" where active = true order by "createdAt" desc, id limit 1`);
    const messages: string[] = [];
    page.on("dialog", (d) => {
      messages.push(d.message());
      void d.dismiss(); // her durumda vazgeç: hiçbir şey uygulanmaz
    });
    const run = async () => {
      messages.length = 0;
      await openAdmin(page);
      await findInProductList(page, prod.title);
      await page.getByLabel(`${prod.title} seç`).first().check();
      const toggle = page.locator("button[aria-controls=admin-selection-detail]");
      if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
      await page.getByRole("button", { name: "Vitrin", exact: true }).click();
      await page.getByLabel("İşlem", { exact: true }).selectOption("remove");
      await page.locator("form", { has: page.getByLabel("İşlem", { exact: true }) }).locator("button[type=submit]").click();
      await expect.poll(() => messages.length, { timeout: 30_000 }).toBeGreaterThan(0);
    };
    try {
      await exec(`update "Product" set "isFeatured" = false where "isFeatured" = true`);
      await refreshStorefront(request, prod.id);
      await run();
      expect(messages.join("\n")).toContain("Öne Çıkanlar şu an otomatik. Bu işlem listeyi elle moda geçirecek");
      expect(messages.join("\n")).toContain("Devam edilsin mi?");
      expect((await rows<{ n: string }>(`select count(*)::text as n from "Product" where "isFeatured" = true`))[0].n, "vazgeçince hiçbir ürün işaretlenmedi").toBe("0");

      await exec(`update "Product" set "isFeatured" = true where id = $1`, [prod.id]);
      await refreshStorefront(request, prod.id);
      await run();
      expect(messages.join("\n")).not.toContain("Öne Çıkanlar şu an otomatik");
      expect((await rows<{ f: boolean }>(`select "isFeatured" as f from "Product" where id = $1`, [prod.id]))[0].f, "vazgeçince işaret duruyor").toBe(true);
    } finally {
      await exec(`update "Product" set "isFeatured" = false where "isFeatured" = true`);
      if (flagged.length) await exec(`update "Product" set "isFeatured" = true where id = any($1::text[])`, [flagged.map((f) => f.id)]);
      await refreshStorefront(request, prod.id);
    }
  });
});
