import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_alias.mjs";

const src = readFileSync(new URL("../app/api/order/route.ts", import.meta.url), "utf8");

test("sipariş kaydı sözleşme onay anını ve sürümünü yazar", () => {
  assert.match(src, /legalConsentAt: new Date\(\),\s*legalConsentVersion: LEGAL_VERSION/);
});

test("onay denetimi (consent !== true → 400) kayıttan önce gelir", () => {
  assert.ok(src.indexOf("body.consent !== true") < src.indexOf("tx.order.create"));
});

test("LEGAL_VERSION, e-postadaki metin sürümüyle aynı değerdir", async () => {
  const m = await import("../lib/legal-texts.ts");
  assert.equal(m.LEGAL_VERSION, m.LEGAL_UPDATED);
});
