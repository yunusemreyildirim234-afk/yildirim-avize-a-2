import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quoteSignature, isCommittableEmail, EMAIL_COMMIT_DELAY_MS } from "../lib/quote-signature.ts";

const base = { lines: [["v1", 2]], couponCode: "", shippingType: "STANDART_KARGO", paymentMethod: "CREDIT_CARD", emailRelevant: false, committedEmail: "", prevOrderId: null };

test("kupon/deneme yokken e-posta imzaya girmez (yazma istek doğurmaz)", () => {
  assert.equal(quoteSignature({ ...base, committedEmail: "a@b.com" }), quoteSignature({ ...base, committedEmail: "" }));
});

test("kupon varken yalnız kesinleşmiş e-posta imzayı değiştirir; sepet/kupon/teslimat değişimi değiştirir", () => {
  const c = { ...base, couponCode: "X", emailRelevant: true };
  assert.notEqual(quoteSignature({ ...c, committedEmail: "a@b.com" }), quoteSignature({ ...c, committedEmail: "" }));
  assert.equal(quoteSignature({ ...c, committedEmail: "a@b.com" }), quoteSignature({ ...c, committedEmail: "a@b.com" }));
  assert.notEqual(quoteSignature(c), quoteSignature({ ...c, lines: [["v1", 3]] }));
  assert.notEqual(quoteSignature(c), quoteSignature({ ...c, prevOrderId: "o1" }));
});

test("geçerli biçim ve 1 sn gecikme", () => {
  assert.equal(isCommittableEmail("a@b.com"), true);
  assert.equal(isCommittableEmail("a@b"), false);
  assert.equal(isCommittableEmail(""), false);
  assert.equal(EMAIL_COMMIT_DELAY_MS, 1000);
  const s = readFileSync(new URL("../app/sepet/page.tsx", import.meta.url), "utf8");
  assert.match(s, /onBlur=\{\(\) => setCommittedEmail\(email\)\}/);
  assert.doesNotMatch(s, /JSON\.stringify\(\[cart\.map\(\(i\) => \[i\.variationId/);
});
