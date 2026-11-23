import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

// DAVRANIŞ: Google giriş dönüşü GERÇEK kodla çalışır; Google ağ istekleri ve veritabanı sahtedir (gerçek istek yok).
// Kural: e-posta küçük harfe çevrilir; mevcut hesap büyük/küçük harf fark etmeden bulunur; yeni hesap küçük harfle kaydedilir.
register("./_hooks-davranis.mjs", import.meta.url);
const route = await import("../app/api/auth/callback/google/route.ts");

const realFetch = globalThis.fetch;
let rec;
function setup(googleEmail, existing = null) {
  rec = { find: [], create: [], urls: [] };
  globalThis.fetch = async (url) => {
    rec.urls.push(String(url));
    const body = String(url).includes("oauth2.googleapis.com") ? { access_token: "at" } : { email: googleEmail, verified_email: true, name: "Ahmet Y" };
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  };
  globalThis.__fakePrisma = {
    user: {
      findFirst: async (a) => (rec.find.push(a), existing && existing.email.toLowerCase() === a.where.email.equals ? existing : null),
      create: async (a) => (rec.create.push(a), { id: "new1", ...a.data }),
      update: async () => ({}),
    },
  };
}
const call = () => route.GET(new Request("http://x/api/auth/callback/google?code=c&state=s1", { headers: { cookie: "ya_oauth_state=s1" } }));

test("yeni hesap: Google e-postası kırpılıp küçük harfe çevrilerek aranır ve KAYDEDİLİR", async () => {
  setup("  Ahmet.Y@GMail.COM ");
  try {
    const res = await call();
    assert.equal(new URL(res.headers.get("location")).pathname, "/giris");
    assert.deepEqual(rec.find[0].where, { email: { equals: "ahmet.y@gmail.com", mode: "insensitive" } });
    assert.equal(rec.create.length, 1);
    assert.equal(rec.create[0].data.email, "ahmet.y@gmail.com");
  } finally { globalThis.fetch = realFetch; }
});

test("mevcut hesap (kayıtta büyük harf var): bulunur, ikinci hesap OLUŞTURULMAZ", async () => {
  setup("AHMET.Y@gmail.com", { id: "u9", email: "Ahmet.Y@Gmail.com", name: "Ahmet" });
  try {
    const res = await call();
    assert.equal(new URL(res.headers.get("location")).pathname, "/giris");
    assert.equal(rec.create.length, 0);
    assert.ok(res.headers.get("set-cookie")?.includes("tok-u9"), "oturum mevcut hesap için açılır");
  } finally { globalThis.fetch = realFetch; }
});

test("doğrulanmamış Google e-postası reddedilir: depoya dokunulmaz", async () => {
  setup("x@y.com");
  globalThis.fetch = async (url) => new Response(JSON.stringify(String(url).includes("oauth2") ? { access_token: "at" } : { email: "x@y.com", verified_email: false }));
  try {
    const res = await call();
    assert.match(res.headers.get("location"), /error=eposta_yok/);
    assert.equal(rec.find.length + rec.create.length, 0);
  } finally { globalThis.fetch = realFetch; }
});
