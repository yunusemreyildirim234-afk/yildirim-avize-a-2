import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const r = readFileSync(new URL("../app/api/admin/activity/route.ts", import.meta.url), "utf8");
const guests = r.slice(r.indexOf('body.scope === "guests"'), r.indexOf('body.scope === "registered"'));

// Gerçek veritabanı sahte depoyla taklit edilemediği için sorgunun biçimi ve davranış korunumu kaynak üzerinden sınanır.
test("misafir silme tek sorgu: parametreli IN/NOT IN listesi yok, alt sorgu var", () => {
  assert.equal((guests.match(/\$executeRaw/g) ?? []).length, 1);
  assert.match(guests, /DELETE FROM "ClientEvent" AS e/);
  assert.match(guests, /NOT EXISTS \(/);
  assert.doesNotMatch(guests.replace(/\/\/[^\n]*/g, ""), /notIn|sessionsOf|findMany/);
});

test("üye tanımı eskisiyle aynı: USER rolü, misafir ödeme hesabı değil, e-posta büyük/küçük harf duyarsız", () => {
  assert.match(guests, /JOIN "User" u ON lower\(r\."email"\) = lower\(u\."email"\)/);
  assert.match(guests, /u\."role" = 'USER'/);
  assert.match(guests, /u\."password" <> 'guest_checkout'/);
  assert.match(guests, /r\."sessionId" = e\."sessionId"/);
});

test("yalnız ClientEvent silinir; User tablosuna yazılmaz", () => {
  assert.doesNotMatch(r, /DELETE FROM "User"|user\.delete|UPDATE "User"/);
});

test("uç: oturum denetimi ve hız sınırı korunur, üye silme eskisi gibi", () => {
  assert.ok(r.indexOf("adminGuard()") < r.indexOf("rateLimit(req"));
  assert.match(r, /rateLimit\(req, "admin-activity-delete", 30, 60_000\)/);
  assert.match(r, /sessionId: \{ in: regSessions \}/);
  assert.match(r, /keys\.length === 0/);
});
