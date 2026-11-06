import test from "node:test";
import assert from "node:assert/strict";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "../lib/unsubscribe-token.ts";

process.env.NEXTAUTH_SECRET = "test-gizli-anahtar";

test("geçerli imza kabul edilir (e-posta normalize: küçük harf, +misafir etiketi temizlenir)", () => {
  assert.equal(verifyUnsubscribeToken(signUnsubscribeToken("Ali@Example.com")), "ali@example.com");
  assert.equal(verifyUnsubscribeToken(signUnsubscribeToken("ali+misafirab12@example.com")), "ali@example.com");
});

test("bozuk, eksik ve boş belirteç reddedilir", () => {
  const t = signUnsubscribeToken("ali@example.com");
  assert.equal(verifyUnsubscribeToken(t.slice(0, -2) + "xx"), null);
  assert.equal(verifyUnsubscribeToken("bozuk"), null);
  assert.equal(verifyUnsubscribeToken(""), null);
  assert.equal(verifyUnsubscribeToken(null), null);
  assert.equal(verifyUnsubscribeToken(undefined), null);
});

test("başka kullanıcının imzası reddedilir", () => {
  const [bodyA] = signUnsubscribeToken("ali@example.com").split(".");
  const [, sigB] = signUnsubscribeToken("veli@example.com").split(".");
  assert.equal(verifyUnsubscribeToken(`${bodyA}.${sigB}`), null);
});

test("farklı gizli anahtarla üretilen belirteç reddedilir", () => {
  const t = signUnsubscribeToken("ali@example.com");
  process.env.NEXTAUTH_SECRET = "baska-anahtar";
  assert.equal(verifyUnsubscribeToken(t), null);
  process.env.NEXTAUTH_SECRET = "test-gizli-anahtar";
});

test("gizli anahtar yoksa doğrulama null döner, imzalama fırlatır", () => {
  const keep = process.env.NEXTAUTH_SECRET;
  delete process.env.NEXTAUTH_SECRET;
  assert.equal(verifyUnsubscribeToken("a.b"), null);
  assert.throws(() => signUnsubscribeToken("ali@example.com"));
  process.env.NEXTAUTH_SECRET = keep;
});
