import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Kablolama testi (diğer uç testleriyle aynı düzen): Google girişinde e-posta küçük harfe çevrilir.
const src = readFileSync(new URL("../app/api/auth/callback/google/route.ts", import.meta.url), "utf8");

test("Google girişi: e-posta küçük harfe çevrilir, arama büyük/küçük harfe duyarsız, yeni hesap küçük harfle kaydedilir", () => {
  assert.match(src, /const email = String\(googleUser\.email\)\.trim\(\)\.toLowerCase\(\)/);
  assert.match(src, /email: \{ equals: email, mode: "insensitive" \}/);
  assert.match(src, /data: \{[^}]*\n\s*email,/s);
  assert.doesNotMatch(src, /email: googleUser\.email/);
});
