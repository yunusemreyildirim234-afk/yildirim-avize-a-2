import { createHmac, timingSafeEqual } from "node:crypto";
import { SITE_URL } from "@/lib/site";

const merchantId = () => process.env.PAYTR_MERCHANT_ID || process.env.MERCHANT_ID || "";
const merchantKey = () => process.env.PAYTR_MERCHANT_KEY || process.env.MERCHANT_KEY || "";
const merchantSalt = () => process.env.PAYTR_MERCHANT_SALT || process.env.MERCHANT_SALT || "";

// PayTR merchant_oid yalnızca alfanümerik olabilir: UUID'nin tireleri kaldırılır
export const toMerchantOid = (orderId: string) => orderId.replace(/-/g, "");
export const fromMerchantOid = (oid: string) =>
  oid.length === 32 ? `${oid.slice(0, 8)}-${oid.slice(8, 12)}-${oid.slice(12, 16)}-${oid.slice(16, 20)}-${oid.slice(20)}` : oid;

const hmac = (data: string) => createHmac("sha256", merchantKey()).update(data + merchantSalt()).digest("base64");

export interface PaytrTokenInput {
  orderId: string;
  email: string;
  amountTl: number;
  userIp: string;
  userName: string;
  userAddress: string;
  userPhone: string;
  basket: { name: string; price: number; quantity: number }[];
}

/** PayTR iFrame API 1. adım: ödeme formu için token alır. */
export async function getPaytrToken(input: PaytrTokenInput): Promise<string> {
  if (!merchantId() || !merchantKey() || !merchantSalt()) throw new Error("PayTR bilgileri .env içinde eksik.");

  const oid = toMerchantOid(input.orderId);
  const paymentAmount = String(Math.round(input.amountTl * 100));
  const userBasket = Buffer.from(
    JSON.stringify(input.basket.map((b) => [b.name.slice(0, 120), b.price.toFixed(2), b.quantity]))
  ).toString("base64");
  const noInstallment = "0";
  const maxInstallment = "0";
  const currency = "TL";
  const testMode = process.env.PAYTR_TEST_MODE ?? (process.env.NODE_ENV === "production" ? "0" : "1");
  // PayTR e-posta alanında Türkçe karakter kabul etmez
  const email = input.email.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

  const paytrToken = hmac(
    `${merchantId()}${input.userIp}${oid}${email}${paymentAmount}${userBasket}${noInstallment}${maxInstallment}${currency}${testMode}`
  );

  const res = await fetch("https://www.paytr.com/odeme/api/get-token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      merchant_id: merchantId(),
      user_ip: input.userIp,
      merchant_oid: oid,
      email,
      payment_amount: paymentAmount,
      paytr_token: paytrToken,
      user_basket: userBasket,
      debug_on: testMode === "1" ? "1" : "0",
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: input.userName.slice(0, 60),
      user_address: input.userAddress.slice(0, 400),
      user_phone: input.userPhone.slice(0, 20),
      merchant_ok_url: `${SITE_URL}/siparis-onay/${input.orderId}`,
      merchant_fail_url: `${SITE_URL}/sepet?odeme=basarisiz`,
      timeout_limit: "30",
      currency,
      test_mode: testMode,
      lang: "tr",
    }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);
  if (data?.status !== "success" || !data.token) {
    throw new Error(`PayTR token alınamadı: ${data?.reason ?? res.status}`);
  }
  return data.token;
}

/** PayTR bildirim (callback) imzasını doğrular. */
export function verifyPaytrCallback(p: { merchant_oid: string; status: string; total_amount: string; hash: string }) {
  const expected = Buffer.from(hmac(`${p.merchant_oid}${merchantSalt()}${p.status}${p.total_amount}`));
  const actual = Buffer.from(p.hash ?? "");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
