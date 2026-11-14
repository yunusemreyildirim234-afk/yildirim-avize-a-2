import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { consumeWith, MAX_ATTEMPTS, MAX_ATTEMPTS_PER_EMAIL } from "../lib/code-consume.ts";

// Sahte depo: her kayıt {id,email,code,used,attempts}; yazmalar senkron olduğundan atomik artış/koşullu tüketim gerçek SQL gibi davranır.
function fakeStore(rows) {
  return {
    findActive: async (email) => rows.filter((r) => r.email === email && !r.used).at(-1) ?? null,
    recentAttempts: async (email) => rows.filter((r) => r.email === email).reduce((n, r) => n + r.attempts, 0),
    recordWrong: async (id) => {
      const r = rows.find((x) => x.id === id);
      if (r && !r.used) { r.attempts += 1; r.used = r.attempts >= MAX_ATTEMPTS; }
    },
    claim: async (id) => {
      const r = rows.find((x) => x.id === id);
      if (!r || r.used) return false;
      r.used = true;
      return true;
    },
  };
}
const row = (over = {}) => ({ id: "c1", email: "a@x.com", code: "123456", used: false, attempts: 0, ...over });

test("5 yanlıştan sonra kod yanar; doğru kod da reddedilir", async () => {
  const rows = [row()];
  const s = fakeStore(rows);
  for (let i = 0; i < MAX_ATTEMPTS; i++) assert.equal(await consumeWith(s, "a@x.com", "REGISTER", "000000"), false);
  assert.equal(rows[0].used, true);
  assert.equal(await consumeWith(s, "a@x.com", "REGISTER", "123456"), false);
});

test("eşzamanlı yanlış denemeler sayaçta kaybolmaz", async () => {
  const rows = [row()];
  const s = fakeStore(rows);
  await Promise.all(Array.from({ length: 5 }, () => consumeWith(s, "a@x.com", "REGISTER", "999999")));
  assert.equal(rows[0].attempts, 5);
  assert.equal(rows[0].used, true);
});

test("iki eşzamanlı doğru denemeden yalnız biri kazanır", async () => {
  const s = fakeStore([row()]);
  const res = await Promise.all([consumeWith(s, "a@x.com", "REGISTER", "123456"), consumeWith(s, "a@x.com", "REGISTER", "123456")]);
  assert.equal(res.filter(Boolean).length, 1);
});

test("e-posta başına toplam sınır: yeni kod üretilse bile 10 yanlıştan sonra doğru kod kabul edilmez", async () => {
  const rows = [row({ id: "old", used: true, attempts: MAX_ATTEMPTS }), row({ id: "mid", used: true, attempts: MAX_ATTEMPTS_PER_EMAIL - MAX_ATTEMPTS }), row({ id: "new" })];
  const s = fakeStore(rows);
  assert.equal(await consumeWith(s, "a@x.com", "REGISTER", "123456"), false);
  assert.equal(rows[2].used, false); // kod tüketilmedi, süre dolunca/pencere kayınca tekrar denenebilir
});

test("sınırın altında doğru kod kabul edilir; başka e-posta etkilenmez", async () => {
  const rows = [row({ id: "o", used: true, attempts: 4 }), row({ id: "n" }), row({ id: "z", email: "b@x.com" })];
  const s = fakeStore(rows);
  assert.equal(await consumeWith(s, "a@x.com", "REGISTER", " 123456 "), true);
  assert.equal(await consumeWith(s, "b@x.com", "REGISTER", "123456"), true);
});

test("verification.ts atomik SQL kullanır", () => {
  const v = readFileSync(new URL("../lib/verification.ts", import.meta.url), "utf8");
  assert.match(v, /"attempts" = "attempts" \+ 1/);
  assert.match(v, /"used" = false/);
});
