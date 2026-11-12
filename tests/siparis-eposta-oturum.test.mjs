import test from "node:test";
import assert from "node:assert/strict";
import { effectiveOrderEmail } from "../lib/order-email.ts";

test("girişli kullanıcı: farklı e-posta gönderilse de hesap e-postası kullanılır", () => {
  assert.equal(effectiveOrderEmail("hesap@ornek.com", "baska@ornek.com"), "hesap@ornek.com");
});

test("misafir (oturumsuz): gövdedeki e-posta aynen kalır", () => {
  assert.equal(effectiveOrderEmail(null, "misafir@ornek.com"), "misafir@ornek.com");
  assert.equal(effectiveOrderEmail(undefined, "misafir@ornek.com"), "misafir@ornek.com");
  assert.equal(effectiveOrderEmail("  ", "misafir@ornek.com"), "misafir@ornek.com");
});
