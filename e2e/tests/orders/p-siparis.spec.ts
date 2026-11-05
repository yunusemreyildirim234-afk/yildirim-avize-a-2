import type { Browser } from "@playwright/test";
import { test, expect, trNumber } from "../../fixtures";
import { autoDialogs, cleanupE2eProducts, createProductViaForm, openAdmin, png, uniq } from "../../admin-helpers";
import { productIdByTitle, rows } from "../../db";
import {
  CUSTOMER,
  CUSTOMER2,
  acceptAgreements,
  addToCartViaPage,
  adminOrderRow,
  buttonTotal,
  cartItem,
  chooseDelivery,
  choosePayment,
  cleanupOrderData,
  couponUsed,
  fillCustomer,
  near,
  newGuest,
  openAdminOrders,
  orderById,
  readSummary,
  submitButton,
  variationOf,
  variationStock,
  waitProductPage,
  type Customer,
  type GuestSession,
} from "../../order-helpers";

// Havale (BANK_TRANSFER) sipariş akışı, uçtan uca. KARTLI ÖDEME TEST EDİLMEZ (PayTR'ye hiç istek gitmez).
// Bir koşuda EN FAZLA 4 istek /api/order'a ulaşır (bellek içi hız sınırı 10 dk'da 5): ana sipariş, kuponlu sipariş, kupon kişi-başı-limit ret çağrısı, stok siparişi.
// Veri: yönetim API'siyle/arayüzüyle "E2E Sipariş" önekli iki ürün + bir kupon; sahte müşteriler. Hepsi afterAll'da silinir.
const PREFIX = "E2E Sipariş";
const POLL = { timeout: 30_000, intervals: [1000, 2000, 3000] };

test.describe.configure({ mode: "serial" });

interface Prod {
  id: string;
  variationId: string;
  title: string;
  variationName: string;
  price: number;
}

test.describe("Havale siparişi (uçtan uca)", () => {
  const sfx = uniq();
  let A: Prod; // fiyat 300 (kargo eşiğinin altı), stok 5
  let B: Prod; // fiyat 500, stok 2
  let couponCode = "";
  let mainOrderId = "";
  let mainTotal = 0;
  let couponOrderId = "";
  let stockBefore = { A: 0 };

  test.afterAll(async ({ request }) => {
    // Sıra: siparişler/bildirimler/müşteriler → ürünler (siparişi olan ürün silinemez) → kupon
    await cleanupOrderData().catch((e) => console.error("[p-siparis] sipariş temizliği:", (e as Error).message));
    await cleanupE2eProducts(request, PREFIX);
    const cs = await rows<{ id: string }>(`select id from "Coupon" where code like 'E2E%'`).catch(() => []);
    for (const c of cs) await request.delete("/api/admin/coupons", { data: { id: c.id } }).catch(() => {});
  });

  async function guestFlow<T>(browser: Browser, baseURL: string, fn: (g: GuestSession) => Promise<T>, opts: { cart?: unknown[] } = {}): Promise<T> {
    const g = await newGuest(browser, baseURL, opts);
    try {
      const out = await fn(g);
      expect(g.serverErrors, "5xx yanıt").toEqual([]);
      return out;
    } finally {
      await g.ctx.close();
    }
  }

  /** Sepet sayfasında teslimat+havale seçer, müşteri bilgisini ve sözleşmeleri doldurur. */
  async function prepareCheckout(g: GuestSession, c: Customer, delivery: "kargo" | "magaza", coupon?: string) {
    const { page } = g;
    await page.goto("/sepet", { waitUntil: "domcontentloaded" });
    await chooseDelivery(page, delivery);
    await choosePayment(page, "havale");
    await fillCustomer(page, c, { address: delivery === "kargo" });
    if (coupon) {
      await page.getByLabel("Kupon kodu").fill(coupon);
      await page.getByRole("button", { name: "Kuponu Uygula" }).click();
      await expect(page.getByText(/kuponu uygulandı/)).toBeVisible();
    }
    await acceptAgreements(page);
    return readSummary(page);
  }

  async function submitOrder(g: GuestSession) {
    const [res] = await Promise.all([g.page.waitForResponse((r) => r.url().endsWith("/api/order") && r.request().method() === "POST"), submitButton(g.page).click()]);
    return { status: res.status(), body: (await res.json()) as { success?: boolean; orderId?: string; error?: string } };
  }

  test("hazırlık: E2E ürünleri (stok 5 ve stok 2) ve kişi başı limitli E2E kuponu", async ({ page, request }) => {
    const dialogs = autoDialogs(page);
    for (const [name, price, stock, sel] of [
      [`${PREFIX} Ürün A ${sfx}`, "300", "5", "A"],
      [`${PREFIX} Ürün B ${sfx}`, "500", "2", "B"],
    ] as const) {
      dialogs.length = 0;
      await openAdmin(page);
      await createProductViaForm(page, { title: name, category: "Kristal", price, photos: [png(120, 90, 40)], colors: [{ name: "E2E Renk", stock }] });
      await expect.poll(() => dialogs.join("|")).toContain("vitrine eklendi");
      const id = (await productIdByTitle(name)) ?? "";
      expect(id, `${name} veritabanında`).not.toBe("");
      const v = await variationOf(id);
      const prod: Prod = { id, variationId: v.id, title: name, variationName: v.variationName, price: v.price };
      if (sel === "A") A = prod;
      else B = prod;
    }
    expect(await variationStock(A.variationId)).toBe(5);
    expect(await variationStock(B.variationId)).toBe(2);

    couponCode = `E2EKUPON${sfx.toUpperCase()}`;
    const res = await request.post("/api/admin/coupons", { data: { code: couponCode, discountType: "PERCENT", discountPercent: 10, maxUses: 5, minCartTotal: 0, perUserOnce: true, expiresAt: "" } });
    expect(res.ok(), `kupon oluşturma: ${res.status()}`).toBe(true);
    expect(await couponUsed(couponCode)).toBe(0);
    await waitProductPage(request, A.id);
    await waitProductPage(request, B.id);
  });

  test("ödeme özeti: kargo eşiği, mağazadan teslim ve havale indirimi arayüzdeki değerlerle tutarlı (sipariş oluşmaz)", async ({ browser, baseURL }) => {
    await guestFlow(browser, baseURL!, async ({ page }) => {
      await addToCartViaPage(page, A.id, 1);
      await page.goto("/sepet", { waitUntil: "domcontentloaded" });
      await chooseDelivery(page, "kargo");
      await choosePayment(page, "havale");
      await fillCustomer(page, CUSTOMER, { address: true });
      await acceptAgreements(page);

      // Arayüzdeki eşik metni: "350 ₺ ve üzeri siparişlerde kargo ücretsiz." (sabit kodda import edilmez, sayfadan okunur)
      const hint = await page.getByText(/ve üzeri siparişlerde kargo ücretsiz/).first().innerText();
      const threshold = Number((hint.match(/(\d+)/) ?? [])[1]);
      expect(threshold, "arayüzdeki ücretsiz kargo eşiği").toBeGreaterThan(0);
      const bankPct = Number(((await page.getByRole("button", { name: /Havale \/ EFT/ }).innerText()).match(/%(\d+)/) ?? [])[1]);

      // 1) eşiğin altı: kargo ücretli, kart üstündeki etiketle aynı tutar
      const under = await readSummary(page);
      expect(under.items).toBeLessThan(threshold);
      expect(under.shippingText).not.toBe("Ücretsiz");
      expect(under.shipping).toBeGreaterThan(0);
      await expect(page.getByText("📦 Adrese Teslim", { exact: true }).locator("xpath=following-sibling::span[1]")).toHaveText(under.shippingText);
      expect(under.bank, "havale indirimi görünür").toBeGreaterThan(0);
      expect(Math.abs(under.bank - ((under.items + under.shipping) * bankPct) / 100), "havale indirimi etiketteki yüzdeyle (tam sayıya yuvarlanmış) uyumlu").toBeLessThanOrEqual(0.5);
      expect(near(under.total, under.items + under.shipping - under.coupon - under.pickup - under.bank), "toplam = ürünler + kargo − indirimler").toBe(true);
      expect(near(await buttonTotal(page), under.total), "düğmedeki tutar = özet toplamı").toBe(true);

      // 2) eşiğin üstü (2 adet): kargo ücretsiz
      await page.getByRole("button", { name: "+", exact: true }).first().click();
      await expect(page.getByText("Ürünler Toplamı", { exact: true }).locator("xpath=following-sibling::span[1]")).not.toHaveText(/^300,00/);
      const over = await readSummary(page);
      expect(over.items).toBeGreaterThanOrEqual(threshold);
      expect(over.shippingText).toBe("Ücretsiz");
      expect(near(over.total, over.items - over.bank), "eşik üstü: toplam = ürünler − havale indirimi").toBe(true);
      await expect(page.getByText("📦 Adrese Teslim", { exact: true }).locator("xpath=following-sibling::span[1]")).toHaveText("Ücretsiz");

      // 3) mağazadan teslim: kargo yok, mağaza indirimi görünür
      await chooseDelivery(page, "magaza");
      const pick = await readSummary(page);
      expect(pick.shippingText).toBe("Ücretsiz");
      expect(pick.pickup, "mağazadan teslim indirimi").toBeGreaterThan(0);
      expect(near(pick.total, pick.items - pick.pickup - pick.bank)).toBe(true);

      // 4) kartta havale indirimi yok
      await choosePayment(page, "kart");
      const card = await readSummary(page);
      expect(card.bank).toBe(0);
      expect(near(card.total, card.items - card.pickup)).toBe(true);
      await expect(page.getByRole("button", { name: /Ödemeye Geç/ })).toBeVisible(); // kartlı ödeme BAŞLATILMAZ: düğmeye basılmaz
    });
  });

  test("havale siparişi: sepet → ödeme → /siparis-onay; stok düşer; yönetici bildirimi oluşur", async ({ browser, baseURL }) => {
    stockBefore.A = await variationStock(A.variationId);
    await guestFlow(browser, baseURL!, async (g) => {
      const { page } = g;
      await addToCartViaPage(page, A.id, 1);
      const summary = await prepareCheckout(g, CUSTOMER, "kargo");
      expect(summary.shipping, "300 ₺ eşiğin altında: kargo ücretli").toBeGreaterThan(0);
      expect(summary.bank).toBeGreaterThan(0);
      mainTotal = summary.total;

      const { status, body } = await submitOrder(g);
      expect(status, JSON.stringify(body)).toBe(200);
      expect(body.success).toBe(true);
      mainOrderId = body.orderId!;
      await page.waitForURL(new RegExp(`/siparis-onay/${mainOrderId}$`));

      // Onay sayfası
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Teşekkürler, Siparişiniz Alındı!");
      await expect(page.getByText(mainOrderId, { exact: true }).first()).toBeVisible(); // sipariş kodu hem özette hem havale kartında
      await expect(page.getByRole("main").getByText(A.title, { exact: true })).toBeVisible();
      await expect(page.getByText("1x", { exact: false }).first()).toBeVisible();
      const shownTotal = trNumber(await page.getByText("Toplam:", { exact: true }).locator("xpath=following-sibling::p[1]").innerText());
      expect(near(shownTotal, mainTotal), `onay sayfası toplamı (${shownTotal}) = ödeme sayfasındaki toplam (${mainTotal})`).toBe(true);
      await expect(page.getByText("Havale / EFT Bilgileri")).toBeVisible();
      await expect(page.getByText(/TR\d{2}\s?\d{4}\s?\d{4}/).first()).toBeVisible(); // IBAN
      await expect(page.getByText("Alıcı Adı")).toBeVisible();
      await expect(page.getByText(/dekontunuzu yükleyerek/)).toBeVisible();
      // Sepet onay sayfasında temizlenir
      await expect.poll(async () => page.evaluate(() => localStorage.getItem("yildirim_cart")), POLL).toBe("[]");
    });

    // Veritabanı (SELECT)
    const o = (await orderById(mainOrderId))!;
    expect(o.status, "havale siparişi ödeme onayına kadar PENDING_NEW").toBe("PENDING_NEW");
    expect(o.paymentMethod).toBe("BANK_TRANSFER");
    expect(o.shippingType).toBe("STANDART_KARGO");
    expect(near(o.totalAmount, mainTotal)).toBe(true);
    expect(o.phone).toBe(CUSTOMER.phone);
    expect(o.address).toBe(CUSTOMER.address);
    expect(o.stockDeducted, "stok sipariş anında ayrılır").toBe(true);
    expect(await variationStock(A.variationId)).toBe(stockBefore.A - 1);
    // E-posta anahtarı boş: e-posta gönderilemedi ama sipariş başarılı ve bildirimler/stok tamam
    const admin = await rows<{ message: string; link: string }>(`select message, link from "Notification" where "userId" is null and "userEmail" is null and title = $1`, [`Yeni Sipariş: #${mainOrderId.slice(0, 8)}`]);
    expect(admin, "yönetici bildirimi").toHaveLength(1);
    expect(admin[0].link).toBe("/admin#siparisler");
    expect(admin[0].message).toContain("Havale (onay bekliyor)");
    const cust = await rows<{ link: string }>(`select link from "Notification" where "userId" = $1 and title = 'Siparişiniz Alındı'`, [o.userId]);
    expect(cust).toHaveLength(1);
    expect(cust[0].link).toBe(`/siparis-onay/${mainOrderId}`);
  });

  test("yönetici: sipariş listede (tarih ve saat dahil); zil bildirimi sipariş bölümünü açar", async ({ page }) => {
    const o = (await orderById(mainOrderId))!;
    expect(o.ageSec, "sipariş yeni oluşturuldu").toBeLessThan(3600);
    await openAdminOrders(page);
    const row = adminOrderRow(page, mainOrderId);
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(CUSTOMER.name);
    await expect(row).toContainText(CUSTOMER.email);
    await expect(row).toContainText(CUSTOMER.phone);
    await expect(row).toContainText(CUSTOMER.address);
    await expect(row).toContainText("1x E2E Renk");
    await expect(row).toContainText("📦 Adrese Teslim");
    await expect(row).toContainText(`${o.totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`);
    await expect(row.getByLabel("Sipariş durumu")).toHaveValue("PENDING_NEW");
    // Tarih + saat: veritabanının hesapladığı İstanbul saatiyle aynı
    const time = row.locator("time");
    await expect(time).toHaveText(/^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}$/);
    expect((await time.innerText()).replace(/\s+/g, " ").trim()).toBe(o.istanbul);

    // Zil: gerçek (sentetik değil) "Yeni Sipariş" bildirimi → /admin#siparisler
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Bildirimler/ }).click();
    await page.getByRole("link", { name: new RegExp(`Yeni Sipariş: #${mainOrderId.slice(0, 8)}`) }).click();
    await page.waitForURL(/\/admin#siparisler/);
    await expect(page.locator("#siparisler > button")).toHaveAttribute("aria-expanded", "true", { timeout: 30_000 });
  });

  test("kuponlu havale siparişi: indirim doğru, kullanım sayısı artar, kişi başı limit aşılınca ikinci kullanım reddedilir", async ({ browser, baseURL }) => {
    expect(await couponUsed(couponCode)).toBe(0);
    stockBefore.A = await variationStock(A.variationId);
    let total = 0;
    await guestFlow(browser, baseURL!, async (g) => {
      const { page } = g;
      await addToCartViaPage(page, A.id, 1);
      const withCoupon = await prepareCheckout(g, CUSTOMER, "magaza", couponCode);
      const pct = Number(((await page.getByText(/kuponu uygulandı/).innerText()).match(/%(\d+)/) ?? [])[1]);
      expect(pct, "arayüzde gösterilen kupon yüzdesi").toBeGreaterThan(0);
      expect(withCoupon.coupon, "kupon satırı görünür").toBeGreaterThan(0);
      expect(near(withCoupon.coupon, (withCoupon.items * pct) / 100, 0.5), "kupon indirimi = ürünler × kupon yüzdesi").toBe(true);
      expect(near(withCoupon.total, withCoupon.items + withCoupon.shipping - withCoupon.coupon - withCoupon.pickup - withCoupon.bank)).toBe(true);
      total = withCoupon.total;

      const { status, body } = await submitOrder(g);
      expect(status, JSON.stringify(body)).toBe(200);
      couponOrderId = body.orderId!;
      await page.waitForURL(new RegExp(`/siparis-onay/${couponOrderId}$`));
      const shown = trNumber(await page.getByText("Toplam:", { exact: true }).locator("xpath=following-sibling::p[1]").innerText());
      expect(near(shown, total)).toBe(true);
      await expect(page.getByText("📍 Mağazadan Teslim", { exact: false }).first()).toBeVisible();
    });
    const o = (await orderById(couponOrderId))!;
    expect(o.couponCode).toBe(couponCode);
    expect(near(o.totalAmount, total)).toBe(true);
    expect(o.status).toBe("PENDING_NEW");
    expect(o.stockDeducted).toBe(true);
    expect(await couponUsed(couponCode), "kupon kullanım sayısı sipariş anında artar").toBe(1);
    expect(await variationStock(A.variationId)).toBe(stockBefore.A - 1);

    // Aynı e-posta ikinci kez: arayüz kuponu uygulamaz (sepetteki doğrulama mesajı ayrıntı sızdırmaz: genel hata)
    await guestFlow(browser, baseURL!, async ({ page }) => {
      await addToCartViaPage(page, A.id, 1);
      await page.goto("/sepet", { waitUntil: "domcontentloaded" });
      await fillCustomer(page, CUSTOMER, { address: false });
      await page.getByLabel("Kupon kodu").fill(couponCode);
      await page.getByRole("button", { name: "Kuponu Uygula" }).click();
      await expect(page.getByText(/Geçersiz veya süresi dolmuş kupon kodu/)).toBeVisible();
      await expect(page.getByText(/kuponu uygulandı/)).toHaveCount(0);
    });

    // Sunucu tarafı (arayüzü atlayan doğrudan çağrı): kişi başı limit /api/order'da da uygulanır ve net mesaj verir. Yeni sipariş OLUŞMAZ.
    await guestFlow(browser, baseURL!, async ({ ctx }) => {
      const before = (await rows<{ n: number }>(`select count(*)::int as n from "Order" where "userId" = $1`, [o.userId]))[0].n;
      const res = await ctx.request.post("/api/order", {
        data: {
          name: CUSTOMER.name,
          email: CUSTOMER.email,
          phone: CUSTOMER.phone,
          address: CUSTOMER.address,
          shippingType: "BEYOGLU_MAGAZA_TESLIM",
          paymentMethod: "BANK_TRANSFER",
          consent: true,
          couponCode,
          items: [{ variationId: A.variationId, quantity: 1 }],
        },
      });
      expect(res.status()).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe("Bu kuponu daha önce kullandınız.");
      expect((await rows<{ n: number }>(`select count(*)::int as n from "Order" where "userId" = $1`, [o.userId]))[0].n, "sipariş oluşmadı").toBe(before);
    });
    expect(await couponUsed(couponCode), "reddedilen çağrı sayacı artırmadı").toBe(1);
    expect(await variationStock(A.variationId), "reddedilen çağrı stoğu düşürmedi").toBe(stockBefore.A - 1);
  });

  test("stok sınırı: stok 2 iken 3 adet engellenir; stok tükenince başka müşteri alamaz", async ({ browser, baseURL }) => {
    expect(await variationStock(B.variationId)).toBe(2);

    // Ürün sayfası: adet stoğu aşamaz
    await guestFlow(browser, baseURL!, async ({ page }) => {
      await page.goto(`/urun/${B.id}`, { waitUntil: "domcontentloaded" });
      const plus = page.getByRole("button", { name: "Adedi artır" }).first();
      for (let i = 0; i < 4; i++) if (await plus.isEnabled()) await plus.click();
      await expect(plus).toBeDisabled();
      await expect(plus.locator("xpath=preceding-sibling::span[1]")).toHaveText("2");
    });

    // Sepette 3 adet: uyarı gösterilir, sipariş isteği sunucuya GİTMEZ (istek taklit edilir ve sayılır)
    await guestFlow(browser, baseURL!, async (g) => {
      const { page } = g;
      let orderCalls = 0;
      await page.route("**/api/order", (route) => {
        orderCalls++;
        return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "e2e taslağı" }) });
      });
      await addToCartViaPage(page, B.id, 2);
      await page.goto("/sepet", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "+", exact: true }).first().click();
      await expect(page.getByRole("alert").filter({ hasText: `"${B.title}" için yeterli stok yok.` })).toBeVisible();
      await chooseDelivery(page, "magaza");
      await choosePayment(page, "havale");
      await fillCustomer(page, CUSTOMER2, { address: false });
      await acceptAgreements(page);
      await submitButton(page).click();
      await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Sepetinizi kontrol edin" })).toBeVisible();
      expect(orderCalls, "stok yetersizken sipariş isteği gönderilmez").toBe(0);
      expect(await variationStock(B.variationId)).toBe(2);
    });

    // 2 adet: sipariş verilir, stok 0 olur
    let orderB = "";
    await guestFlow(browser, baseURL!, async (g) => {
      await addToCartViaPage(g.page, B.id, 2);
      await prepareCheckout(g, CUSTOMER2, "magaza");
      const { status, body } = await submitOrder(g);
      expect(status, JSON.stringify(body)).toBe(200);
      orderB = body.orderId!;
      await g.page.waitForURL(new RegExp(`/siparis-onay/${orderB}$`));
    });
    expect(await variationStock(B.variationId), "stok tükendi").toBe(0);
    expect((await orderById(orderB))!.stockDeducted).toBe(true);

    // Başka müşteri aynı ürünü sepetinde görür ama sipariş veremez (anlaşılır mesaj, istek gitmez)
    await guestFlow(
      browser,
      baseURL!,
      async (g) => {
        const { page } = g;
        let orderCalls = 0;
        await page.route("**/api/order", (route) => {
          orderCalls++;
          return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "e2e taslağı" }) });
        });
        await page.goto("/sepet", { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("alert").filter({ hasText: `"${B.title}" için yeterli stok yok.` })).toBeVisible();
        await chooseDelivery(page, "magaza");
        await choosePayment(page, "havale");
        await fillCustomer(page, { ...CUSTOMER2, email: "e2e-siparis3@example.invalid", phone: "0500 000 00 03" }, { address: false });
        await acceptAgreements(page);
        await submitButton(page).click();
        await expect(page.locator("[data-sonner-toast]").filter({ hasText: "yeterli stok yok" })).toBeVisible();
        expect(orderCalls).toBe(0);
      },
      { cart: [cartItem({ productId: B.id, variationId: B.variationId, title: B.title, variationName: B.variationName, price: B.price, quantity: 1 })] }
    );
  });

  test("stok tükenince ürün sayfası 'Stokta Yok' gösterir", async ({ browser, baseURL }) => {
    // BULGU: sipariş akışı (/api/order → finalizeOrder) vitrin önbelleğini yenilemiyor; stok 0 olduktan sonra ürün sayfası 30 sn boyunca hâlâ "Sepete Ekle" gösteriyor.
    // Korunma sepet/teklif/sipariş katmanında (önceki test): müşteri sepette uyarı alır, sipariş reddedilir. Önbellek yenilenince bu test "beklenmedik geçti" diye uyarır.
    test.fail(true, "BULGU: stok tükenince vitrin önbelleği yenilenmiyor; ürün sayfası eski stoğu gösteriyor");
    await guestFlow(browser, baseURL!, async ({ page }) => {
      await expect
        .poll(
          async () => {
            await page.goto(`/urun/${B.id}`, { waitUntil: "domcontentloaded" });
            return page.getByRole("button", { name: /^Stokta Yok$/ }).count();
          },
          { message: "tükenen ürün sayfası", ...POLL }
        )
        .toBe(1);
      await expect(page.getByRole("button", { name: /^Stokta Yok$/ })).toBeDisabled();
    });
  });

  test("yönetici iptali: stok ve kupon kullanımı iade edilir; e-posta kapalı olsa da iptal hata vermez", async ({ page, request }) => {
    const stockNow = await variationStock(A.variationId);
    expect(await couponUsed(couponCode)).toBe(1);
    await openAdminOrders(page);
    const row = adminOrderRow(page, couponOrderId);
    await expect(row.getByLabel("Sipariş durumu")).toHaveValue("PENDING_NEW");
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/admin/order-status") && r.request().method() === "POST"),
      row.getByLabel("Sipariş durumu").selectOption("CANCELLED"),
    ]);
    expect(res.status()).toBe(200);
    expect(((await res.json()) as { success: boolean }).success).toBe(true);

    const o = (await orderById(couponOrderId))!;
    expect(o.status).toBe("CANCELLED");
    expect(o.stockDeducted, "stok bayrağı sıfırlandı").toBe(false);
    expect(await variationStock(A.variationId), "stok iade edildi").toBe(stockNow + 1);
    expect(await couponUsed(couponCode), "kupon kullanımı iade edildi").toBe(0);

    // Kişi başı hak da serbest: aynı e-posta kuponu yeniden doğrulatabilir
    const check = await request.post("/api/coupon", { data: { code: couponCode, email: CUSTOMER.email, lines: [{ productId: A.id, lineTotal: A.price }] } });
    expect(check.status(), "iptalden sonra kupon yeniden kullanılabilir").toBe(200);

    // Diğer sipariş (ana sipariş) etkilenmedi
    expect((await orderById(mainOrderId))!.status).toBe("PENDING_NEW");
    expect((await orderById(mainOrderId))!.stockDeducted).toBe(true);
  });

  test("sipariş sayfası erişimi: yalnızca tahmin edilemez kimlikle; var olmayan kimlik 404; kişisel veri sızmaz", async ({ browser, baseURL }) => {
    await guestFlow(browser, baseURL!, async ({ ctx, page }) => {
      // Var olmayan / geçersiz kimlik
      // Not: sayfanın loading.tsx'i akışı 200 ile başlattığı için HTTP durumu 200 kalır (soft-404, bulgu); içerik 404 sayfasıdır ve sipariş verisi yoktur.
      for (const id of ["00000000-0000-4000-8000-000000000000", "abc"]) {
        const r = await page.goto(`/siparis-onay/${encodeURIComponent(id)}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu Işık Söndü");
        await expect(page.getByText("Hata 404")).toBeVisible();
        await expect(page.getByText("Sipariş Takip Kodu")).toHaveCount(0);
        test.info().annotations.push({ type: "bulgu", description: `/siparis-onay/${id}: içerik 404 ama HTTP durumu ${r!.status()} (soft-404)` });
      }
      // BULGU (rapor): /siparis-onay/[id] oturum/sahiplik kontrolü yapmaz; kimliği (UUID) bilen herkes görür.
      const res = await page.goto(`/siparis-onay/${mainOrderId}`, { waitUntil: "domcontentloaded" });
      test.info().annotations.push({ type: "bulgu", description: `Oturumsuz ziyaretçi /siparis-onay/<id> sayfasını gördü (HTTP ${res!.status()}): sahiplik kontrolü yok, erişim yalnızca UUID'nin tahmin edilemezliğine bağlı` });
      expect(res!.status()).toBe(200);
      const html = await page.content();
      for (const secret of [CUSTOMER.email, CUSTOMER.phone, CUSTOMER.address]) expect(html, `sayfada "${secret}" olmamalı`).not.toContain(secret);
      // Aynı kimlikle kargo takibi: yalnızca durum bilgisi, kişisel veri yok
      await page.goto(`/kargo-takip?code=${mainOrderId}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(mainOrderId, { exact: true }).first()).toBeVisible();
      const track = await page.content();
      for (const secret of [CUSTOMER.email, CUSTOMER.phone, CUSTOMER.address]) expect(track).not.toContain(secret);
      // Sipariş geçmişi ve fatura: oturumsuz erişimde bu sipariş görünmez / reddedilir
      const history = await ctx.request.get("/giris");
      expect(history.status()).toBe(200);
      expect(await history.text()).not.toContain(mainOrderId);
      const invoice = await ctx.request.get(`/api/orders/${mainOrderId}/invoice`);
      expect([401, 403, 404], `fatura ucu oturumsuz: ${invoice.status()}`).toContain(invoice.status());
    });
  });

  test("sipariş sayfasında müşteri adı maskelenir (KVKK)", async ({ browser, baseURL }) => {
    await guestFlow(browser, baseURL!, async ({ page }) => {
      await page.goto(`/siparis-onay/${mainOrderId}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(/Sayın/)).toContainText("E2E M.");
      await expect(page.getByText(/Sayın/)).not.toContainText("Müşteri");
    });
  });
});
