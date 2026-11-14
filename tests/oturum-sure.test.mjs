import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.NEXTAUTH_SECRET = "test-secret";
const { signSession, verifySession, SESSION_MAX_AGE, USER_SESSION_MAX_AGE, cookieOptions, userCookieOptions } = await import("../lib/session.ts");
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const expOf = async (tok) => (await verifySession(tok)).exp;

test("sabitler: yönetici 8 saat, müşteri 30 gün", () => {
  assert.equal(SESSION_MAX_AGE, 8 * 3600);
  assert.equal(USER_SESSION_MAX_AGE, 30 * 86400);
  assert.equal(cookieOptions.maxAge, 8 * 3600);
  assert.equal(userCookieOptions.maxAge, 30 * 86400);
  assert.equal(userCookieOptions.httpOnly, true);
  assert.equal(userCookieOptions.path, "/");
});

test("varsayılan imza (yönetici) 8 saat; müşteri süresi verilince 30 gün", async () => {
  const t0 = Date.now();
  const admin = await expOf(await signSession({ role: "admin", av: 0 }));
  assert.ok(Math.abs(admin - (t0 + 8 * 3600_000)) < 5_000);
  const user = await expOf(await signSession({ uid: "u1", sv: 0, purpose: "session" }, USER_SESSION_MAX_AGE));
  assert.ok(Math.abs(user - (t0 + 30 * 86400_000)) < 5_000);
});

test("kablolama: yönetici çerezi cookieOptions, müşteri çerezi userCookieOptions kullanır; müşteri belirteci 30 gün", () => {
  assert.match(read("lib/account.ts"), /purpose: "session" \}, USER_SESSION_MAX_AGE\)/);
  for (const f of ["app/api/auth/route.ts", "app/api/auth/verify-code/route.ts", "app/api/auth/logout-all/route.ts", "app/api/auth/callback/google/route.ts"]) {
    assert.match(read(f), /userCookieOptions/, f);
    assert.doesNotMatch(read(f), /\bcookieOptions\b/, f);
  }
  for (const f of ["app/api/auth/admin/route.ts", "app/api/admin/password/route.ts", "app/api/admin/sessions/route.ts"]) {
    assert.match(read(f), /\bcookieOptions\b/, f);
    assert.doesNotMatch(read(f), /userCookieOptions/, f);
  }
  assert.doesNotMatch(read("lib/admin-session.ts"), /USER_SESSION_MAX_AGE/);
});
