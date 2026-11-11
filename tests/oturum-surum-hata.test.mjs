import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXTAUTH_SECRET = "unit-test-secret-not-for-production";
const { verifyVersioned, versionMatches, verifyAdminSessionWith, signSession } = await import("../lib/session.ts");

const boom = async () => {
  throw new Error("db down");
};
const quiet = async (fn) => {
  const orig = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = orig;
  }
};

test("versionMatches: sürüm eşleşmesi; null (kayıt/okuma yok) saf kural olarak eşleşir", () => {
  assert.equal(versionMatches(2, 2), true);
  assert.equal(versionMatches(1, 2), false);
  assert.equal(versionMatches(undefined, 0), true);
  assert.equal(versionMatches(undefined, 1), false);
  assert.equal(versionMatches(5, null), true);
});

test("DB hatasında yönetici ('av') reddedilir; müşteri ('sv') etkilenmez", async () => {
  await quiet(async () => {
    assert.equal(await verifyVersioned({ av: 3 }, "av", boom), null);
    const user = { uid: "u1", sv: 3 };
    assert.equal(await verifyVersioned(user, "sv", boom), user);
  });
});

test("DB sağlıklıyken eşleşen yönetici geçer, iptal edilen ('av' eski) reddedilir; oturum yoksa null", async () => {
  assert.deepEqual(await verifyVersioned({ av: 2 }, "av", async () => 2), { av: 2 });
  assert.equal(await verifyVersioned({ av: 1 }, "av", async () => 2), null);
  assert.equal(await verifyVersioned(null, "av", async () => 0), null);
});

test("yönetici çerezi hata anında reddedilir, DB dönünce AYNI çerez yeniden geçerli olur (çerez silinmez)", async () => {
  const token = await signSession({ role: "admin", av: 4 });
  await quiet(async () => assert.equal(await verifyAdminSessionWith(token, boom), null));
  const again = await verifyAdminSessionWith(token, async () => 4);
  assert.equal(again?.role, "admin");
});

test("kaynak: oturum doğrulaması çerez silmez; müşteri tarafı (account.ts) aynı verifyVersioned'i kullanır", async () => {
  const { readFileSync } = await import("node:fs");
  const s = readFileSync(new URL("../lib/session.ts", import.meta.url), "utf8");
  const fn = s.slice(s.indexOf("export async function verifyVersioned"), s.indexOf("async function readAdminVersion"));
  assert.ok(!/cookies|delete\(/.test(fn));
  const a = readFileSync(new URL("../lib/account.ts", import.meta.url), "utf8");
  assert.match(a, /verifyVersioned\(session, "sv"/);
});
