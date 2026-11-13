import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { touchLastLogin, LAST_LOGIN_MIN_GAP_MS } from "../lib/last-login.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("son giriş: tek koşullu yazma (hiç yazılmamış ya da 24 saatten eski); okuma yok", async () => {
  const calls = [];
  const now = new Date("2026-11-13T12:00:00Z");
  await touchLastLogin({ updateMany: async (a) => void calls.push(a) }, "u1", now);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.id, "u1");
  assert.deepEqual(calls[0].where.OR, [{ lastLoginAt: null }, { lastLoginAt: { lt: new Date(now.getTime() - LAST_LOGIN_MIN_GAP_MS) } }]);
  assert.deepEqual(calls[0].data, { lastLoginAt: now });
});

test("son giriş yazımı hata verirse girişi engellemez", async () => {
  await assert.doesNotReject(touchLastLogin({ updateMany: async () => { throw new Error("db"); } }, "u1"));
});

test("üç giriş yolu da son girişi yazar (şifre, 2FA, Google)", () => {
  for (const f of ["app/api/auth/route.ts", "app/api/auth/verify-code/route.ts", "app/api/auth/callback/google/route.ts"]) assert.match(read(f), /touchLastLogin\(prisma\.user,/, f);
});

test("e-posta: .invalid (silinmiş hesap) adresine hiç gönderilmez", () => {
  const src = read("lib/email.ts");
  assert.match(src, /endsWith\("\.invalid"\)/);
  assert.ok(src.indexOf('endsWith(".invalid")') < src.indexOf("RESEND_API_KEY tanımlı değil"), "kontrol anahtar kontrolünden önce");
});

test("müşteri ucu: oturum + hız sınırı; talep ve iptal transaction içinde", () => {
  const src = read("app/api/user/account-deletion/route.ts");
  assert.match(src, /getSessionUserId/);
  assert.equal((src.match(/rateLimit\(req, "account-deletion"/g) ?? []).length, 2);
  assert.equal((src.match(/prisma\.\$transaction/g) ?? []).length, 2);
});

test("silme yalnızca yönetici onayıyla: müşteri ucu approveDeletionRequest kullanmaz", () => {
  assert.doesNotMatch(read("app/api/user/account-deletion/route.ts"), /approveDeletionRequest/);
});
