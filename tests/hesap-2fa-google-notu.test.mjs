import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Hesabım 2FA bölümünde Google girişinde ek kod istenmediği yazar", () => {
  const s = readFileSync(new URL("../components/AccountSecurity.tsx", import.meta.url), "utf8");
  assert.match(s, /Google ile girişte ek kod istenmez\./);
});
