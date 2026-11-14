import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rateLimit, tooMany } from "../lib/rate-limit.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8").replace(/\r\n/g, "\n"); // Windows'ta CRLF çıkışı
const reqFrom = (ip) => new Request("http://x.test/api", { headers: { "x-forwarded-for": ip } });

// Uçların kullandığı kalıbın aynısı: sınır aşılınca 429 + Türkçe mesaj + Retry-After
function guarded(req, name, max) {
  const rl = rateLimit(req, name, max, 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);
  return new Response("ok");
}

test("sınır sonrası 429 ve Türkçe mesaj; sınıra kadar normal", async () => {
  for (let i = 0; i < 60; i++) assert.equal(guarded(reqFrom("1.1.1.1"), "t-sinir", 60).status, 200, `istek ${i + 1}`);
  const res = guarded(reqFrom("1.1.1.1"), "t-sinir", 60);
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get("Retry-After")) >= 1);
  assert.match((await res.json()).error, /Çok fazla/);
});

test("sınır IP başınadır: başka IP etkilenmez", () => {
  for (let i = 0; i < 61; i++) guarded(reqFrom("2.2.2.2"), "t-ip", 60);
  assert.equal(guarded(reqFrom("2.2.2.2"), "t-ip", 60).status, 429);
  assert.equal(guarded(reqFrom("3.3.3.3"), "t-ip", 60).status, 200);
});

const EXPECT = [
  ["../app/api/cart/route.ts", [/"cart-put", 60/]],
  ["../app/api/favorites/route.ts", [/"favorites-put", 60/]],
  ["../app/api/notifications/route.ts", [/"notifications-get", 120/, /"notifications-write", 60/]],
  ["../app/api/messages/route.ts", [/"messages-get", 60/]],
  ["../app/api/my-coupons/route.ts", [/"my-coupons-get", 60/]],
  ["../app/api/user/addresses/route.ts", [/"address-read", 60/]],
  ["../app/api/auth/me/route.ts", [/"auth-me", 120/]],
  ["../app/api/auth/logout/route.ts", [/"auth-logout", 60/]],
  ["../app/api/company/route.ts", [/"company-get", 60/]],
  ["../app/api/product-images/[id]/route.ts", [/"product-image", 300/]],
  ["../app/api/review-images/[id]/route.ts", [/"review-image", 300/]],
];

test("uçlar hız sınırını işlemden önce uygular (429 + tooMany)", () => {
  for (const [file, pats] of EXPECT) {
    const s = read(file);
    for (const p of pats) assert.match(s, p, `${file} ${p}`);
    assert.match(s, /if \(rl\.limited\) return tooMany\(rl\.retryAfter\)/, file);
    // sınır, korunan işleyicinin ilk satırıdır (veritabanı/oturumdan önce)
    assert.match(s, /export async function (GET|PUT|POST|DELETE)\(req: Request[^)]*\) \{\n  const rl = rateLimit\(req/, `${file}: sınır işleyicinin ilk satırı`);
  }
  // bildirim ucunda üç işleyicinin üçü de korunur
  assert.equal((read("../app/api/notifications/route.ts").match(/rateLimit\(req/g) ?? []).length, 3);
});
