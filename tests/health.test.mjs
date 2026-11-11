import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dbHealthy } from "../lib/health.ts";

test("dbHealthy: başarılı yoklama true", async () => {
  assert.equal(await dbHealthy(async () => 1), true);
});

test("dbHealthy: hata false", async () => {
  assert.equal(await dbHealthy(async () => { throw new Error("bağlantı yok"); }), false);
});

test("dbHealthy: asılı kalan yoklama zaman aşımında false (hızlıca)", async () => {
  const t0 = Date.now();
  assert.equal(await dbHealthy(() => new Promise(() => {}), 80), false);
  assert.ok(Date.now() - t0 < 1000);
});

test("uç: varsayılan DB'siz, ?db=1 ile SELECT 1, 503, no-store, rateLimit; proxy matcher'ı değişmedi", () => {
  const src = readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  const dbIdx = src.indexOf("prisma.$queryRaw");
  assert.ok(dbIdx > src.indexOf('searchParams.get("db") !== "1"'), "DB yoklaması yalnızca ?db=1 dalında");
  assert.match(src, /rateLimit\(req, "health"/);
  assert.match(src, /status: db \? 200 : 503/);
  assert.match(src, /"Cache-Control": "no-store"/);
  assert.match(src, /Neon|uyanık/);
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  assert.doesNotMatch(proxy, /health/);
});
