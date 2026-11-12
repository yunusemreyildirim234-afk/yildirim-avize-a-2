import test from "node:test";
import assert from "node:assert/strict";
import { UNLIMITED_USES, isUnlimitedUses, parseMaxUses, usesLabels } from "../lib/coupon-limit.ts";

test("boş limit 1000000 gönderilir; dolu değer aynen sayıya çevrilir", () => {
  assert.equal(parseMaxUses(""), 1_000_000);
  assert.equal(parseMaxUses("   "), UNLIMITED_USES);
  assert.equal(parseMaxUses("25"), 25);
});

test("1.000.000 ve üstü Sınırsız gösterilir", () => {
  assert.equal(isUnlimitedUses(1_000_000), true);
  assert.equal(isUnlimitedUses(999_999), false);
  assert.deepEqual(usesLabels(3, 1_000_000), { used: "3 / ∞", rest: "Sınırsız" });
  assert.deepEqual(usesLabels(3, 5_000_000), { used: "3 / ∞", rest: "Sınırsız" });
  assert.deepEqual(usesLabels(3, 10), { used: "3 / 10", rest: "Kalan: 7" });
});
