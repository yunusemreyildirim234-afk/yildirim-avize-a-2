import { test, expect, openOk } from "../fixtures";

// Müşteri hesabı e2e'de oluşturulamaz (e-posta doğrulama kodu e-postayla gelir, e-posta kapalı): giriş yapmış durum bileşen/uç düzeyinde
// birim testle (tests/unsubscribe-token.test.mjs, price-drop.test.mjs) sınanır; burada anonim yollar sınanır.
test.describe("m) E-posta izni ve çıkış (anonim)", () => {
  test("/favorilerim: giriş yapmamışta şerit giriş yönlendirmesi gösterir, taşma yok", async ({ page }) => {
    await openOk(page, "/favorilerim");
    const strip = page.getByText("Fiyat düşüşü bildirimi için giriş yapın.");
    await expect(strip).toBeVisible();
    await expect(page.getByRole("link", { name: /Giriş yap/ })).toHaveAttribute("href", "/giris");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "yatay taşma").toBeLessThanOrEqual(0);
  });

  test("/abonelik-iptal: bozuk bağlantıda genel mesaj, noindex, çıkış işlemi yok", async ({ page }) => {
    await openOk(page, "/abonelik-iptal?t=bozuk.imza");
    await expect(page.getByText("Bağlantı geçerli değil", { exact: true })).toBeVisible();
    expect(await page.locator("meta[name='robots']").getAttribute("content")).toMatch(/noindex/);
    await expect(page.getByRole("button", { name: /bildirimleri kapat/i })).toHaveCount(0);
  });

  test("/api/unsubscribe: GET yan etkisiz yönlendirme; geçersiz belirteçle tek tıkla POST reddedilir", async ({ request }) => {
    const get = await request.get("/api/unsubscribe?t=x.y", { maxRedirects: 0 });
    expect(get.status()).toBe(303);
    expect(get.headers()["location"]).toContain("/abonelik-iptal?t=");
    const post = await request.post("/api/unsubscribe?t=x.y", { form: { "List-Unsubscribe": "One-Click" } });
    expect(post.status()).toBe(400);
  });

  test("/api/user/marketing: anonimde GET 200 (anon), PATCH 401", async ({ request }) => {
    const get = await request.get("/api/user/marketing");
    expect(get.status()).toBe(200);
    expect(await get.json()).toEqual({ anon: true });
    const patch = await request.patch("/api/user/marketing", { data: { enabled: true } });
    expect(patch.status()).toBe(401);
  });
});
