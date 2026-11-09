import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXTAUTH_SECRET = "unit-test-secret-not-for-production";
const { signSession, verifyUserSession } = await import("../lib/session.ts");

const UID = "user-1";

test("2FA bekleyen jeton ve e-posta kanıtları oturum olarak reddedilir", async () => {
  for (const purpose of ["2fa-login", "admin-2fa-login", "CHANGE_PASSWORD", "REGISTER", "RESET_PASSWORD"]) {
    const token = await signSession({ email: "a@b.co", purpose, at: Date.now(), uid: UID });
    assert.equal(await verifyUserSession(token), null, purpose);
  }
});

test("yönetici ve geri alma belirteçleri kullanıcı oturumu değildir", async () => {
  assert.equal(await verifyUserSession(await signSession({ role: "admin", av: 0, uid: UID })), null);
  assert.equal(await verifyUserSession(await signSession({ kind: "order-undo", uid: UID })), null);
});

test("yeni oturum biçimi kabul edilir", async () => {
  const s = await verifyUserSession(await signSession({ uid: UID, sv: 3, purpose: "session", picture: "x" }));
  assert.equal(s?.uid, UID);
  assert.equal(s?.sv, 3);
});

test("amaç alanı olmayan eski açık oturumlar bozulmaz", async () => {
  assert.equal((await verifyUserSession(await signSession({ uid: UID, sv: 0 })))?.uid, UID);
  assert.equal((await verifyUserSession(await signSession({ uid: UID })))?.uid, UID);
});

test("uid'siz veya bozuk belirteç reddedilir", async () => {
  assert.equal(await verifyUserSession(await signSession({ sv: 0 })), null);
  assert.equal(await verifyUserSession("bozuk.belirtec"), null);
  assert.equal(await verifyUserSession(null), null);
});
