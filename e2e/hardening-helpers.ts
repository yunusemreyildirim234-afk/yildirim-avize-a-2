import crypto from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "./fixtures";
import { autoDialogs, cleanupE2eProducts, createProductViaForm, openAdmin, png, settleStorefront } from "./admin-helpers";
import { exec, productIdByTitle, rows } from "./db";
import { cleanupOrderData, variationOf } from "./order-helpers";

// Ödeme/sipariş sertleştirme testlerinin ortak yardımcıları. Veri "E2E " önekli ürün ve e2e-*@example.invalid müşterilerdir; siparişler SQL ile, tarihi geriye alınarak üretilir.

export const PREFIX = "E2E Sertlestirme";

/** Bu testlerin ayrı hız sınırı sayacı (belge aralığı IP'si): /api/order bütçesi p-siparis ile paylaşılmaz. */
export const clientHeaders = (lastOctet: number) => ({ "x-forwarded-for": `203.0.113.${lastOctet}` });

const pageDialogs = new WeakMap<Page, string[]>();

export async function createProduct(page: Page, title: string, stock: number) {
  // Sayfa başına tek dinleyici: ikinci autoDialogs aynı pencereyi yeniden kabul etmeye çalışır
  const dialogs = pageDialogs.get(page) ?? autoDialogs(page);
  pageDialogs.set(page, dialogs);
  dialogs.length = 0;
  await openAdmin(page);
  await createProductViaForm(page, { title, category: "Kristal", price: "300", photos: [png(120, 90, 40)], colors: [{ name: "E2E Renk", stock: String(stock) }] });
  await expect.poll(() => dialogs.join("|")).toContain("vitrine eklendi");
  const id = (await productIdByTitle(title)) ?? "";
  expect(id, `${title} veritabanında`).not.toBe("");
  return { id, variation: await variationOf(id) };
}

export async function seedUser(email: string, name: string, password = "guest_checkout"): Promise<string> {
  return (await rows<{ id: string }>(`insert into "User" (id, name, email, password, "updatedAt") values (gen_random_uuid()::text, $1, $2, $3, now() at time zone 'UTC') returning id`, [name, email, password]))[0].id;
}

export interface SeedOrder {
  userId: string;
  status: string;
  paymentMethod: "BANK_TRANSFER" | "CREDIT_CARD";
  phone: string;
  ageHours?: number;
  stockDeducted?: boolean;
  couponCode?: string;
  receiptUrl?: string;
  orderNote?: string;
  barcode?: string;
  tracking?: string;
  item?: { variationId: string; quantity: number };
}

export async function seedOrder(o: SeedOrder): Promise<string> {
  const id = (
    await rows<{ id: string }>(
      `insert into "Order" (id, "userId", "totalAmount", "paymentMethod", "shippingType", status, phone, address, "stockDeducted", "couponCode", "receiptUrl", "orderNote", "shippingBarcode", "shippingTrackingCode", "kargonomiShipmentId", "createdAt", "updatedAt")
       values (gen_random_uuid()::text, $1, 1234.5, $2, 'STANDART_KARGO', $3, $4, 'E2E Test Mah.', $5, $6, $7, $8, $9, $10, $11, (now() at time zone 'UTC') - make_interval(hours => $12), now() at time zone 'UTC') returning id`,
      [o.userId, o.paymentMethod, o.status, o.phone, o.stockDeducted ?? false, o.couponCode ?? null, o.receiptUrl ?? null, o.orderNote ?? null, o.barcode ?? null, o.tracking ?? null, o.barcode || o.tracking ? 987654 : null, o.ageHours ?? 0]
    )
  )[0].id;
  if (o.item) await exec(`insert into "OrderItem" (id, "orderId", "variationId", quantity, "unitPrice") values (gen_random_uuid()::text, $1, $2, $3, 300)`, [id, o.item.variationId, o.item.quantity]);
  return id;
}

/** Sunucunun signSession biçiminde üye oturum çerezi değeri (e2e sunucusunun sabit sırrıyla; playwright.config.ts NEXTAUTH_SECRET). */
export function memberToken(userId: string): string {
  const body = Buffer.from(JSON.stringify({ uid: userId, sv: 0, exp: Date.now() + 3_600_000 })).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", "e2e-only-secret-not-for-production").update(body).digest("base64url")}`;
}

export const dbNow = async () => (await rows<{ t: string }>(`select (now() at time zone 'UTC')::text as t`))[0].t;

/** Sipariş, müşteri ve (since'ten sonra üretilen) cron bildirimleri, ardından ürünler. */
export async function cleanupHardening(request: APIRequestContext, since: string) {
  const members = (await rows<{ id: string }>(`select id from "User" where email ilike 'e2e-%@example.invalid' and password <> 'guest_checkout'`)).map((u) => u.id);
  if (members.length) {
    await exec(`delete from "Notification" where "userId" = any($1)`, [members]);
    await exec(`delete from "Order" where "userId" = any($1)`, [members]);
    await exec(`delete from "User" where id = any($1)`, [members]);
  }
  await cleanupOrderData();
  await exec(`delete from "Notification" where "createdAt" >= $1::timestamp and title like any($2)`, [since, ["Havale siparişi otomatik iptal:%", "Siparişiniz iptal edildi"]]);
  await cleanupE2eProducts(request, PREFIX);
  await settleStorefront(request);
}
