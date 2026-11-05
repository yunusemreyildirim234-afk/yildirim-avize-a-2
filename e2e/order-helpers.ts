import type { APIRequestContext, Browser, BrowserContext, Page } from "@playwright/test";
import { expect, lockNetwork, trNumber } from "./fixtures";
import { exec, rows } from "./db";

// ---- Sahte müşteriler (açıkça test verisi; e-posta .invalid alan adıdır, gerçek bir adrese çözülmez) ----
export interface Customer {
  name: string;
  email: string;
  phone: string;
  address: string;
}
export const CUSTOMER: Customer = { name: "E2E Müşteri", email: "e2e-siparis@example.invalid", phone: "0500 000 00 01", address: "E2E Test Mah. No:1" };
export const CUSTOMER2: Customer = { name: "E2E Müşteri İki", email: "e2e-siparis2@example.invalid", phone: "0500 000 00 02", address: "E2E Test Mah. No:2" };
/** Temizlik ve kalıntı denetimi yalnızca bu kalıpla eşleşen kullanıcıya ait satırlara dokunur. */
export const E2E_EMAIL_LIKE = "e2e-%@example.invalid";

const CONSENT_KEY = "ya-cerez-onayi";
const CART_KEY = "yildirim_cart";

export interface GuestSession {
  ctx: BrowserContext;
  page: Page;
  /** 5xx dönen yanıtlar (sipariş akışında hiç olmamalı). */
  serverErrors: string[];
}

/**
 * Oturumsuz müşteri bağlamı (yönetici çerezi yok). Ağ kilidi aynen uygulanır; Kargonomi il/ilçe uçları anahtarsız 502 döndüğü için
 * yalnızca bu bağlamda SABİT yanıtlarla taklit edilir (gerçek istek yok). Çerez çubuğu, onay anahtarı yazılarak ("rejected") kapalı tutulur.
 */
export async function newGuest(browser: Browser, baseURL: string, opts: { cart?: unknown[] } = {}): Promise<GuestSession> {
  const ctx = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    viewport: { width: 1280, height: 800 },
    serviceWorkers: "block",
  });
  await lockNetwork(ctx, baseURL);
  await ctx.route("**/api/kargonomi/locations**", (route) => {
    const stateId = new URL(route.request().url()).searchParams.get("stateId");
    const body = stateId ? { cities: [{ id: 425, name: "BEYOĞLU" }] } : { states: [{ id: 34, name: "İSTANBUL" }] };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await ctx.addInitScript(
    ({ consentKey, cartKey, cart }) => {
      try {
        localStorage.setItem(consentKey, "rejected");
        if (cart && !localStorage.getItem(cartKey)) localStorage.setItem(cartKey, JSON.stringify(cart));
      } catch {
        /* depolama kapalı */
      }
    },
    { consentKey: CONSENT_KEY, cartKey: CART_KEY, cart: opts.cart ?? null }
  );
  const page = await ctx.newPage();
  const serverErrors: string[] = [];
  page.on("response", (r) => {
    if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
  });
  return { ctx, page, serverErrors };
}

/** Yerel sepet kaydı (localStorage "yildirim_cart") biçiminde kalem. */
export function cartItem(v: { productId: string; variationId: string; title: string; variationName: string; price: number; quantity: number }) {
  return { productId: v.productId, variationId: v.variationId, title: v.title, imageUrl: null, variationName: v.variationName, price: v.price, bulk: [], quantity: v.quantity };
}

// ---- Ürün sayfası / sepet ----

/** Ürün sayfasının (vitrin önbelleği "eskiyi sun, arkada yenile") yayınlanmasını bekler. */
export async function waitProductPage(request: APIRequestContext, id: string) {
  await expect.poll(async () => (await request.get(`/urun/${id}`)).status(), { message: "ürün sayfası", timeout: 30_000, intervals: [1000, 2000, 3000] }).toBe(200);
}

/** Ürün sayfasından adet kadar sepete ekler. */
export async function addToCartViaPage(page: Page, productId: string, quantity = 1) {
  await page.goto(`/urun/${productId}`, { waitUntil: "domcontentloaded" });
  const add = page.getByRole("button", { name: /^Sepete Ekle$/ });
  await expect(add).toBeEnabled();
  for (let i = 1; i < quantity; i++) await page.getByRole("button", { name: "Adedi artır" }).first().click(); // ürün sayfasındaki ilk (diğerleri öneri kartları)
  await add.click();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Sepete eklendi" }).first()).toBeVisible();
}

export const submitButton = (page: Page) => page.getByRole("button", { name: /Siparişi Tamamla|Ödemeye Geç/ });

export async function chooseDelivery(page: Page, kind: "kargo" | "magaza") {
  await page.getByText(kind === "kargo" ? "📦 Adrese Teslim" : "📍 Mağazadan Teslim", { exact: true }).click();
}

export async function choosePayment(page: Page, kind: "havale" | "kart") {
  await page.getByRole("button", { name: kind === "havale" ? /Havale \/ EFT/ : /Kredi \/ Banka Kartı/ }).click();
}

export async function fillCustomer(page: Page, c: Customer, opts: { address: boolean }) {
  await page.getByLabel(/Adınız Soyadınız/).fill(c.name);
  await page.getByLabel("E-posta Adresiniz").fill(c.email);
  await page.getByLabel(/Telefon Numaranız/).fill(c.phone);
  if (opts.address) await page.getByLabel(/Açık Teslimat Adresiniz/).fill(c.address);
}

export async function acceptAgreements(page: Page) {
  await page.locator("label", { hasText: "Ön Bilgilendirme Koşulları" }).locator('input[type="checkbox"]').check();
  await page.locator("label", { hasText: "Mesafeli Satış Sözleşmesi" }).locator('input[type="checkbox"]').check();
}

export interface Summary {
  items: number;
  shipping: number;
  shippingText: string;
  coupon: number;
  pickup: number;
  bank: number;
  total: number;
}

/**
 * "Sipariş Özeti"ndeki arayüz değerleri. Gönder düğmesi etkinse sunucu teklifi (fresh) gelmiştir: yerel hesap değil, sunucunun tutarı okunur.
 * Yoksa satırlar 0 sayılır.
 */
export async function readSummary(page: Page): Promise<Summary> {
  await expect(submitButton(page)).toBeEnabled();
  const text = async (label: string | RegExp): Promise<string> => {
    const l = page.getByText(label, { exact: typeof label === "string" });
    return (await l.count()) === 0 ? "" : (await l.first().locator("xpath=following-sibling::span[1]").innerText()).trim();
  };
  const num = async (label: string | RegExp) => {
    const t = await text(label);
    return t ? trNumber(t) : 0;
  };
  const shippingText = await text("Kargo / Teslimat");
  return {
    items: await num("Ürünler Toplamı"),
    shipping: shippingText === "Ücretsiz" ? 0 : trNumber(shippingText),
    shippingText,
    coupon: await num(/^Kupon \(/),
    pickup: await num(/^Mağazadan Teslim İndirimi/),
    bank: await num(/^Havale İndirimi/),
    total: await num("Toplam Tutar"),
  };
}

export const near = (a: number, b: number, tol = 0.011) => Math.abs(a - b) <= tol;

/** Düğmedeki "(1.234,00 ₺)" tutarı. */
export async function buttonTotal(page: Page): Promise<number> {
  return trNumber(((await submitButton(page).innerText()).match(/\(([^)]+)\)/) ?? [])[1] ?? "");
}

// ---- Yönetim paneli ----

/** Bütün siparişler (varsayılan süzgeç iptal/teslim edilenleri gizler) açık olarak /admin?durum=tumu. */
export async function openAdminOrders(page: Page) {
  const h1 = page.getByRole("heading", { level: 1 }).first();
  for (let i = 0; i < 5; i++) {
    await page.goto("/admin?durum=tumu", { waitUntil: "domcontentloaded" });
    await h1.waitFor();
    if (/Operasyon/.test((await h1.textContent()) ?? "")) break;
    await page.waitForTimeout(3000);
  }
  await expect(h1).toContainText("Operasyon");
  const btn = page.locator("#siparisler > button");
  if ((await btn.getAttribute("aria-expanded")) !== "true") await btn.click();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
}

export const adminOrderRow = (page: Page, orderId: string) => page.locator("#siparisler tbody tr", { has: page.getByText(`${orderId.slice(0, 8)}...`) });

// ---- Veritabanı (yalnızca SELECT; kilit db.ts'te) ----

export interface OrderRow {
  id: string;
  status: string;
  paymentMethod: string;
  shippingType: string;
  totalAmount: number;
  stockDeducted: boolean;
  couponCode: string | null;
  userId: string;
  phone: string | null;
  address: string | null;
  createdAt: Date;
  /** Veritabanının hesapladığı İstanbul saati "GG.AA.YYYY SS:DD" (sitenin biçimlendirmesinden bağımsız doğrulama için). */
  istanbul: string;
  /** Veritabanı saatine göre siparişin yaşı (sn). */
  ageSec: number;
}

export async function orderById(id: string): Promise<OrderRow | undefined> {
  return (await rows<OrderRow>(`select id, status, "paymentMethod", "shippingType", "totalAmount", "stockDeducted", "couponCode", "userId", phone, address, "createdAt", to_char(("createdAt" at time zone 'UTC') at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI') as istanbul, extract(epoch from ((now() at time zone 'UTC') - "createdAt"))::float as "ageSec" from "Order" where id = $1`, [id]))[0];
}

export async function variationStock(variationId: string): Promise<number> {
  return (await rows<{ stock: number }>(`select stock from "ProductVariation" where id = $1`, [variationId]))[0].stock;
}

export async function couponUsed(code: string): Promise<number> {
  return (await rows<{ n: number }>(`select "usedCount" as n from "Coupon" where code = $1`, [code]))[0].n;
}

export async function variationOf(productId: string): Promise<{ id: string; title: string; variationName: string; price: number; stock: number }> {
  const r = await rows<{ id: string; title: string; variationType: string; variationValue: string; price: number; stock: number }>(
    `select v.id, p.title, v."variationType", v."variationValue", (p."basePrice" + v."extraPrice") as price, v.stock from "ProductVariation" v join "Product" p on p.id = v."productId" where p.id = $1 order by v.position limit 1`,
    [productId]
  );
  return { id: r[0].id, title: r[0].title, variationName: `${r[0].variationType}: ${r[0].variationValue}`, price: Number(r[0].price), stock: r[0].stock };
}

// ---- Temizlik (yalnızca sahte e-postalı müşterilerin satırları) ----

/**
 * E2E müşterilerinin siparişlerini (kalemler/dekont zincirleme silinir), bildirimlerini ve misafir kullanıcı kayıtlarını siler.
 * Ürün ve kupon, sipariş silindikten SONRA yönetim API'siyle silinmelidir (siparişi olan ürün silinemez).
 * Stok/kupon sayaçları geri yazılmaz: bunlar yalnızca E2E ürününe/kuponuna aittir ve ardından silinir; gerçek ürünlere dokunulmaz.
 */
export async function cleanupOrderData() {
  const users = (await rows<{ id: string }>(`select id from "User" where email ilike $1 and password = 'guest_checkout'`, [E2E_EMAIL_LIKE])).map((u) => u.id);
  const orders = users.length ? (await rows<{ id: string }>(`select id from "Order" where "userId" = any($1)`, [users])).map((o) => o.id) : [];
  const adminTitles = orders.flatMap((id) => [`Yeni Sipariş: #${id.slice(0, 8)}`, `Stok yetersiz: #${id.slice(0, 8)}`]);
  await exec(
    `delete from "Notification" where ("userId" = any($1)) or ("userEmail" ilike $2) or ("userId" is null and "userEmail" is null and title = any($3))`,
    [users, E2E_EMAIL_LIKE, adminTitles]
  );
  if (orders.length) await exec(`delete from "Order" where id = any($1)`, [orders]);
  if (users.length) await exec(`delete from "User" where id = any($1)`, [users]);
}
