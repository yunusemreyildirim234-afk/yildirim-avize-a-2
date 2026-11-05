import test from "node:test";
import assert from "node:assert/strict";
import { isValidPhone } from "../lib/phone.ts";

test("geçerli telefon biçimleri", () => {
  for (const p of ["0532 123 45 67", "05321234567", "+90 532 123 45 67", "(0532) 123 45 67", "532 123 45 67"]) {
    assert.equal(isValidPhone(p), true, p);
  }
});

test("geçersiz telefonlar", () => {
  for (const p of ["abc", "123", "", "   ", "0532 123 45 6x", "05321234567890", "0532-123-45-67; drop"]) {
    assert.equal(isValidPhone(p), false, p);
  }
});
