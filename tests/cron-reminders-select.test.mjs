import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../app/api/cron/reminders/route.ts", import.meta.url), "utf8");

test("cron/reminders: maxDuration tanımlı, kullanıcı yalnız e-posta ve ad olarak seçilir (parola özeti gelmez)", () => {
  assert.match(src, /export const maxDuration = \d+;/);
  assert.doesNotMatch(src, /include:\s*\{\s*user:\s*true/);
  assert.doesNotMatch(src, /user:\s*true/);
});
