import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPasswordOrDummy } from "../lib/password.ts";
import { adminEnvLoginEnabled, planAdminLogin } from "../lib/admin-2fa.ts";

const elapsed = (fn) => {
  const t = performance.now();
  for (let i = 0; i < 3; i++) fn();
  return performance.now() - t;
};

test("verifyPasswordOrDummy: yalnızca gerçek ve doğru şifre true döner", () => {
  const stored = hashPassword("Dogru-Sifre1!");
  assert.equal(verifyPasswordOrDummy("Dogru-Sifre1!", stored), true);
  assert.equal(verifyPasswordOrDummy("yanlis", stored), false);
  assert.equal(verifyPasswordOrDummy("dummy-customer-login-timing", undefined), false, "sahte hash'in kendisi giriş açmaz");
  assert.equal(verifyPasswordOrDummy("guest_checkout", "guest_checkout"), false);
  assert.equal(verifyPasswordOrDummy("google_oauth", "google_oauth"), false);
});

test("hesap yoksa da scrypt maliyeti harcanır", () => {
  const stored = hashPassword("Dogru-Sifre1!");
  verifyPasswordOrDummy("x", undefined); // sahte hash bir kez üretilir
  const real = elapsed(() => verifyPasswordOrDummy("yanlis", stored));
  const missing = elapsed(() => verifyPasswordOrDummy("yanlis", undefined));
  const guest = elapsed(() => verifyPasswordOrDummy("yanlis", "guest_checkout"));
  assert.ok(missing > real * 0.4, `hesap yok ${missing} / gerçek ${real}`);
  assert.ok(guest > real * 0.4, `misafir ${guest} / gerçek ${real}`);
});

test(".env yönetici girişi yalnızca ADMIN_ENV_LOGIN=1 iken açık", () => {
  assert.equal(adminEnvLoginEnabled("1"), true);
  for (const v of [undefined, "", "0", "true", "yes"]) assert.equal(adminEnvLoginEnabled(v), false, String(v));
});

test("veritabanı hesabı ve 2FA kararı değişmedi", () => {
  const a = { id: "a", role: "ADMIN", twoFactorEnabled: true };
  assert.equal(planAdminLogin(false, a), "DENY");
  assert.equal(planAdminLogin(true, a), "NEED_CODE");
  assert.equal(planAdminLogin(true, { ...a, twoFactorEnabled: false }), "COOKIE");
});
