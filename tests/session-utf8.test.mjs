import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXTAUTH_SECRET = "unit-test-secret-not-for-production";
const { signSession, verifySession } = await import("../lib/session.ts");

const TR = "ş ğ ı İ ö ü ç Ş Ğ Ö Ü Ç — Şandelye";

test("Türkçe harfli yük yuvarlak gidiş-dönüşte eşit kalır", async () => {
  const token = await signSession({ category: TR, nested: { title: "Çok Güzel Işık İçin" } });
  const back = await verifySession(token);
  assert.equal(back?.category, TR);
  assert.deepEqual(back?.nested, { title: "Çok Güzel Işık İçin" });
});

test("ASCII belirteç eskisi gibi çözülür (eski biçim: btoa + UTF-8 baytları)", async () => {
  const token = await signSession({ role: "admin", av: 3 });
  const back = await verifySession(token);
  assert.equal(back?.role, "admin");
  assert.equal(back?.av, 3);
});

test("imzası bozulmuş belirteç reddedilir", async () => {
  const token = await signSession({ category: TR });
  const [body, sig] = token.split(".");
  assert.equal(await verifySession(`${body}.${sig.slice(0, -2)}AA`), null);
  assert.equal(await verifySession(`${body}x.${sig}`), null);
  assert.equal(await verifySession(`${body}.`), null);
});

test("süresi dolmuş belirteç reddedilir", async () => {
  const realNow = Date.now;
  try {
    const token = await signSession({ category: TR });
    Date.now = () => realNow() + 9 * 60 * 60 * 1000;
    assert.equal(await verifySession(token), null);
  } finally {
    Date.now = realNow;
  }
});
