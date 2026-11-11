import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REQUIRED_PRODUCTION_ENV, checkProductionEnv, missingEnv } from "../lib/env-check.ts";

const full = Object.fromEntries(REQUIRED_PRODUCTION_ENV.map((n) => [n, "gizli-deger"]));

test("zorunlu liste istenen 11 adı içerir", () => {
  assert.deepEqual([...REQUIRED_PRODUCTION_ENV].sort(), ["BLOB_READ_WRITE_TOKEN", "CRON_SECRET", "DATABASE_URL", "KARGONOMI_API_KEY", "KARGONOMI_API_TOKEN", "KARGONOMI_WEBHOOK_SECRET", "NEXTAUTH_SECRET", "PAYTR_MERCHANT_ID", "PAYTR_MERCHANT_KEY", "PAYTR_MERCHANT_SALT", "RESEND_API_KEY"]);
});

test("production dışında hiçbir şey denetlenmez/loglanmaz", () => {
  const logs = [];
  assert.deepEqual(checkProductionEnv({ VERCEL_ENV: "preview" }, (...a) => logs.push(a)), []);
  assert.deepEqual(checkProductionEnv({}, (...a) => logs.push(a)), []);
  assert.equal(logs.length, 0);
});

test("production + eksik: yalnızca adlar loglanır, değer asla; fırlatmaz", () => {
  const logs = [];
  const env = { ...full, VERCEL_ENV: "production", CRON_SECRET: undefined, RESEND_API_KEY: "   " };
  const missing = checkProductionEnv(env, (...a) => logs.push(a.join(" ")));
  assert.deepEqual(missing, ["CRON_SECRET", "RESEND_API_KEY"]);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /CRON_SECRET, RESEND_API_KEY/);
  assert.doesNotMatch(logs[0], /gizli-deger/);
});

test("production + hepsi tanımlı: sessiz", () => {
  const logs = [];
  assert.deepEqual(checkProductionEnv({ ...full, VERCEL_ENV: "production" }, (...a) => logs.push(a)), []);
  assert.equal(logs.length, 0);
  assert.deepEqual(missingEnv(full), []);
});

test("instrumentation yalnızca node çalışma zamanında ve env-check'i çağırır", () => {
  const src = readFileSync(new URL("../instrumentation.ts", import.meta.url), "utf8");
  assert.match(src, /NEXT_RUNTIME !== "nodejs"/);
  assert.match(src, /checkProductionEnv\(\)/);
});
