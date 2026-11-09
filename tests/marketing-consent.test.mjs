import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { writeConsent } from "../lib/consent-write.ts";

function makeDb(initial) {
  const rows = new Map(initial);
  const calls = [];
  return {
    rows,
    calls,
    marketingConsent: {
      findUnique: async ({ where }) => (rows.has(where.email) ? { unsubscribedAt: rows.get(where.email).unsubscribedAt } : null),
      create: async ({ data }) => {
        calls.push("create");
        rows.set(data.email, { ...data, unsubscribedAt: null });
      },
      upsert: async ({ where, create, update }) => {
        calls.push("upsert");
        rows.set(where.email, rows.has(where.email) ? { ...rows.get(where.email), ...update } : { ...create, unsubscribedAt: null });
      },
    },
  };
}
const base = { email: "A@Test.com", textVersion: "v1", source: "siparis" };

test("kayıt yoksa sipariş yolunda oluşur", async () => {
  const db = makeDb([]);
  await writeConsent(db, { ...base, reactivate: false });
  assert.equal(db.rows.get("a@test.com").source, "siparis");
  assert.equal(db.rows.get("a@test.com").unsubscribedAt, null);
});

test("abonelikten çıkmış e-posta sipariş yoluyla yeniden aktif olmaz", async () => {
  const out = new Date("2026-01-01");
  const db = makeDb([["a@test.com", { unsubscribedAt: out }]]);
  await writeConsent(db, { ...base, reactivate: false });
  assert.equal(db.rows.get("a@test.com").unsubscribedAt, out);
  assert.deepEqual(db.calls, []);
});

test("Hesabım yolu (varsayılan) abonelikten çıkmışı yeniden aktif eder", async () => {
  const db = makeDb([["a@test.com", { unsubscribedAt: new Date() }]]);
  await writeConsent(db, base);
  assert.equal(db.rows.get("a@test.com").unsubscribedAt, null);
});

test("/api/order marketingOptIn yalnızca === true ise onay yazar ve reactivate: false kullanır", () => {
  const src = readFileSync(new URL("../app/api/order/route.ts", import.meta.url), "utf8");
  assert.match(src, /if \(body\.marketingOptIn === true\)/);
  assert.match(src, /recordConsent\(\{[^}]*source: "siparis"[^}]*reactivate: false/);
});

test("/api/marketing-consent artık kayıt yazmaz", () => {
  const src = readFileSync(new URL("../app/api/marketing-consent/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /recordConsent|prisma|marketingConsent\./);
  assert.match(src, /recorded: false/);
});

test("sepet ayrı /api/marketing-consent isteği atmaz, bayrağı siparişe ekler", () => {
  const src = readFileSync(new URL("../app/sepet/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /fetch\("\/api\/marketing-consent"/);
  assert.match(src, /marketingOptIn,\n/);
});
