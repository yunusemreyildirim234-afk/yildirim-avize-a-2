import type { Page } from "@playwright/test";
import { test, expect, productLinks } from "../../fixtures";
import { autoDialogs, expandPanel, openAdmin, uniq } from "../../admin-helpers";
import { exec, rows } from "../../db";

const POLL = { timeout: 30_000, intervals: [1000, 2000, 3000] };
type Cfg = Record<string, unknown> | null;

const siteState = async () => (await rows<{ show: string | null; cfg: Cfg }>(`select "showcaseCouponId" as show, "homepageConfig" as cfg from "SiteConfig" where id = 1`))[0];
const couponById = async (id: string) => (await rows<{ code: string }>(`select code from "Coupon" where id = $1`, [id]))[0]?.code ?? null;

const row = (page: Page, code: string) => page.locator("tbody tr", { has: page.getByText(code, { exact: true }) }).first();

async function openEdit(page: Page, code: string) {
  await row(page, code).getByRole("button", { name: "Düzenle" }).click();
  return page.locator("tbody tr.bg-amber-50\\/40");
}

test.describe("Admin kupon", () => {
  // Güvenlik ağı: test yarıda kalsa bile E2E kuponları (ve vitrin bağı başka kupona gitmişse) temizlenir; aksi halde kalıntı denetimi başarısız olur.
  test.afterAll(async ({ request }) => {
    const leftovers = await rows<{ id: string }>(`select id from "Coupon" where code like 'E2E%'`).catch(() => []);
    for (const c of leftovers) await request.delete("/api/admin/coupons", { data: { id: c.id } }).catch(() => {});
  });

  test("oluştur, yeniden adlandır (kurallar), vitrin kuponu metinleri; sonda temizlik", async ({ page, request }) => {
    const u = uniq();
    const code = `E2ETEST${u.toUpperCase()}`;
    const dialogs = autoDialogs(page);
    const original = await siteState();
    let id = "";

    try {
      await test.step("oluştur", async () => {
        await openAdmin(page);
        await expandPanel(page, /Promosyon Kodları Yönetimi/);
        await page.getByPlaceholder("Örn: OMER10").fill(code);
        await page.locator('div:has(> label:text-is("Kullanım Limiti")) input').fill("1000");
        await page.getByRole("button", { name: "Promosyon Kodu Oluştur" }).click();
        await expect(row(page, code)).toBeVisible({ timeout: 30_000 });
        const r = await rows<{ id: string }>(`select id from "Coupon" where code = $1`, [code]);
        id = r[0]?.id ?? "";
        expect(id).not.toBe("");
      });

      await test.step("geçersiz adlar reddedilir (3-32 karakter, harf/rakam/-/_), kod değişmez", async () => {
        for (const [bad, expectMsg] of [
          ["ab", /3-32 karakter/],
          ["abc!d", /3-32 karakter/],
          ["x".repeat(33), /3-32 karakter/],
          ["YILDIRIM11", /başka bir promosyon kodunda/],
        ] as const) {
          const edit = await openEdit(page, code);
          dialogs.length = 0;
          await edit.locator('div:has(> label:text-is("Kod Adı")) input').fill(bad);
          await edit.getByRole("button", { name: "Kaydet" }).click();
          await expect.poll(() => dialogs.join("|"), { message: `"${bad}" reddi`, timeout: 30_000 }).toMatch(expectMsg);
          expect(await couponById(id), `"${bad}" sonrası kod`).toBe(code);
          // düzenleme formu açık kalır; aynı satırın Düzenle düğmesi onu kapatır
          await row(page, code).getByRole("button", { name: "Düzenle" }).click();
        }
      });

      await test.step("vitrin kuponu olarak bağla (varsayılan avantaj kartları), ürün sayfası ve ana sayfa kodu gösterir", async () => {
        // Arayüzde vitrin kuponu seçme yok; veritabanından bağlanır. Varsayılan kartlar kodu vitrin kuponundan alır, bu yüzden kayıtlı kartlar geçici kaldırılır. Sonda aynen geri yüklenir.
        const cfg = original.cfg ? { ...original.cfg } : {};
        delete cfg.promoCards;
        await exec(`update "SiteConfig" set "showcaseCouponId" = $1, "homepageConfig" = $2::jsonb where id = 1`, [id, JSON.stringify(cfg)]);
        await request.patch("/api/admin/coupons", { data: { id, active: true } }); // vitrini yenile (2xx)

        const productHref = await firstProductHref(page);
        await expect.poll(() => productPageHasCode(page, productHref, code), { message: "ürün sayfası eski kod", ...POLL }).toBe(true);
        await expect.poll(() => homeHasText(page, code), { message: "ana sayfa kartı", ...POLL }).toBe(true);
      });

      await test.step("adı değiştir: büyük harf / ASCII dönüşümü; ürün sayfası ve ana sayfa yeni adı gösterir", async () => {
        const newCode = `E2ESEKER${u.toUpperCase()}`;
        await openAdmin(page);
        await expandPanel(page, /Promosyon Kodları Yönetimi/);
        const edit = await openEdit(page, code);
        await edit.locator('div:has(> label:text-is("Kod Adı")) input').fill(`e2e şeker ${u}`); // boşluk silinir, ş→S, küçük→büyük
        await edit.getByRole("button", { name: "Kaydet" }).click();
        await expect(row(page, newCode)).toBeVisible({ timeout: 30_000 });
        expect(await couponById(id)).toBe(newCode);
        expect((await siteState()).show, "vitrin bağı kimlikte kalır").toBe(id);

        const productHref = await firstProductHref(page);
        await expect.poll(() => productPageHasCode(page, productHref, newCode), { message: "ürün sayfası yeni kod", ...POLL }).toBe(true);
        await expect.poll(() => homeHasText(page, newCode), { message: "ana sayfa kartı yeni kod", ...POLL }).toBe(true);
        expect(await productPageHasCode(page, productHref, code), "eski kod kalmamalı").toBe(false);
        expect(await homeHasText(page, code), "eski kod ana sayfada kalmamalı").toBe(false);
      });
    } finally {
      // 1) ayarları aynen geri yükle  2) kuponu sil (siler ve vitrini yeniler)
      await exec(`update "SiteConfig" set "showcaseCouponId" = $1, "homepageConfig" = $2::jsonb where id = 1`, [original.show, original.cfg === null ? null : JSON.stringify(original.cfg)]);
      if (id) await request.delete("/api/admin/coupons", { data: { id } });
      const after = await siteState();
      expect(after, "vitrin kuponu ve ana sayfa ayarı başlangıçtaki gibi").toEqual(original);
      if (id) expect(await couponById(id), "E2E kuponu silindi").toBeNull();
    }
  });

  test("siparişi olan kuponun adı değiştirilemez kuralı", async ({ request }) => {
    // Kural (app/api/admin/coupons): yalnızca KİŞİ BAŞI LİMİTLİ kuponlarda, eski kodla verilmiş sipariş varsa adı değiştirilemez.
    const c = await rows<{ id: string; code: string }>(`select c.id, c.code from "Coupon" c where c."perUserLimit" is not null and exists (select 1 from "Order" o where o."couponCode" = c.code) limit 1`);
    test.skip(c.length === 0, "e2e veritabanında siparişi olan kişi-başı-limitli kupon yok (sipariş oluşturma Aşama 3); kural test edilmedi");
    const res = await request.patch("/api/admin/coupons", { data: { id: c[0].id, code: `${c[0].code}X`, discountType: "PERCENT", discountPercent: 5, perUserOnce: true } });
    expect(res.status()).toBe(409);
  });
});

async function firstProductHref(page: Page): Promise<string> {
  await page.goto("/kategori/tum");
  return (await productLinks(page).first().getAttribute("href"))!;
}
async function productPageHasCode(page: Page, href: string, code: string): Promise<boolean> {
  await page.goto(href);
  return (await page.locator("main").getByText(`${code} kuponuyla`).count()) > 0;
}
async function homeHasText(page: Page, text: string): Promise<boolean> {
  await page.goto("/");
  return (await page.locator("main").getByText(text, { exact: false }).count()) > 0;
}

