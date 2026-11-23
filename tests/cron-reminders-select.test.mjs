import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { selectedLeaves } from "./_select-projection.mjs";

// DAVRANIŞ: cron/reminders GERÇEK kodla çalışır (sahte depo, e-posta/bildirim sahte). Kural: kullanıcı yalnız { email, name } seçilir
// (parola özeti gelmez), `user: true` / include yok; ayrıca uç süre sınırını dışa aktarır.
register("./_hooks-davranis.mjs", import.meta.url);
process.env.CRON_SECRET = "test-gizli";
const route = await import("../app/api/cron/reminders/route.ts");

const calls = [];
const method = (model, name) => async (args) => {
  calls.push({ model, name, args });
  if (name === "findMany" || name === "$queryRaw") return [];
  if (name === "count") return 0;
  if (name === "findFirst" || name === "findUnique") return null;
  if (name === "aggregate" || name === "groupBy") return [];
  return { count: 0 };
};
globalThis.__fakePrisma = new Proxy({}, {
  get: (_, model) => {
    if (model === "$transaction") return async (fn) => (typeof fn === "function" ? fn(globalThis.__fakePrisma) : Promise.all(fn));
    if (model === "$queryRaw" || model === "$executeRaw") return method("raw", model);
    return new Proxy({}, { get: (_t, name) => method(String(model), String(name)) });
  },
});

const get = (auth) => route.GET(new Request("http://x/api/cron/reminders", { headers: auth ? { authorization: auth } : {} }));

test("yetkisiz çağrı 401: veritabanına hiç gidilmez", async () => {
  calls.length = 0;
  assert.equal((await get()).status, 401);
  assert.equal((await get("Bearer yanlis")).status, 401);
  assert.equal(calls.length, 0);
});

test("uç süre sınırını dışa aktarır", () => {
  assert.ok(Number.isInteger(route.maxDuration) && route.maxDuration > 0);
});

test("çalışırken hiçbir sorguda kullanıcı tamamı/include ile okunmaz; user yalnız { email, name }", async () => {
  calls.length = 0;
  const res = await get("Bearer test-gizli");
  assert.equal(res.status, 200);
  const withUser = calls.filter((c) => JSON.stringify(c.args ?? {}).includes('"user"'));
  assert.ok(withUser.length >= 2, "kullanıcı içeren sorgular çalıştı");
  for (const c of withUser) {
    const json = JSON.stringify(c.args);
    assert.doesNotMatch(json, /"include"/, `${c.model}.${c.name} include kullanmamalı`);
    assert.doesNotMatch(json, /"user":true/, `${c.model}.${c.name} user: true olmamalı`);
    const user = c.args.select?.user?.select;
    assert.ok(user, `${c.model}.${c.name} user için select vermeli`);
    assert.deepEqual(Object.keys(user).sort(), ["email", "name"]);
  }
  // hiçbir sorguda parola/özet alanı seçilmez
  const all = new Set(calls.flatMap((c) => [...selectedLeaves(c.args)]));
  assert.ok(!all.has("password") && !all.has("passwordHash"));
});
