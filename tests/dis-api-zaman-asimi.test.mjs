import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { isTimeoutError } from "../lib/shipping-claim.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("zaman aşımı sinyali PayTR token, Resend ve Google token çağrılarında var", () => {
  const paytr = read("lib/paytr.ts");
  assert.match(paytr, /PAYTR_TOKEN_TIMEOUT_MS = 10_000/);
  assert.match(paytr, /get-token[\s\S]*?signal: AbortSignal\.timeout\(PAYTR_TOKEN_TIMEOUT_MS\)/);
  const email = read("lib/email.ts");
  assert.match(email, /RESEND_TIMEOUT_MS = 8_000/);
  assert.match(email, /api\.resend\.com\/emails[\s\S]*?signal: AbortSignal\.timeout\(RESEND_TIMEOUT_MS\)/);
  const google = read("app/api/auth/callback/google/route.ts");
  assert.match(google, /oauth2\.googleapis\.com\/token[\s\S]*?signal: AbortSignal\.timeout\(10_000\)/);
});

test("Resend reddinde logda yanıt gövdesi yalnızca message ile sınırlı; zaman aşımı mevcut catch → false yolunda", () => {
  const email = read("lib/email.ts");
  assert.match(email, /\(\(await res\.json\(\)\.catch\(\(\) => null\)\) as \{ message\?: unknown \} \| null\)\?\.message \?\? null/);
  const send = email.slice(email.indexOf("async function sendViaResend"), email.indexOf("/** Tutar dökümü"));
  assert.match(send, /\} catch \(err\) \{[\s\S]*Resend bağlantı hatası/);
  assert.match(send, /return false;/);
});

test("PayTR: zaman aşımı fetch'i reddeder; sipariş ucu bu hatayı mevcut 502 yoluna alır", () => {
  const order = read("app/api/order/route.ts");
  assert.match(order, /getPaytrToken\(/);
  assert.match(order, /serverError\("order\/paytr", err, "Ödeme başlatılamadı\. Lütfen tekrar deneyin\.", 502\)/);
});

test("AbortSignal.timeout asılı kalan yanıtı TimeoutError ile reddeder (yerel sahte sunucu)", async () => {
  const server = http.createServer(() => { /* yanıt vermez */ });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const { port } = server.address();
    const err = await fetch(`http://127.0.0.1:${port}/`, { method: "POST", signal: AbortSignal.timeout(150) }).then(() => null, (e) => e);
    assert.ok(err, "istek reddedilmeli");
    assert.equal(isTimeoutError(err), true);
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
