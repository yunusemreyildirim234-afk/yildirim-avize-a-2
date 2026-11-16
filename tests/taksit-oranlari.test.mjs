import test from "node:test";
import assert from "node:assert/strict";
import { BANK_LOGOS, formatRate, INSTALLMENT_BANKS, INSTALLMENT_COUNTS, isKuveytTurk } from "../lib/installments.ts";

test("9 banka, her birinde 3/6/9/12 taksit satırı ve sayısal oran", () => {
  assert.equal(INSTALLMENT_BANKS.length, 9);
  for (const b of INSTALLMENT_BANKS) {
    assert.deepEqual(Object.keys(b.rates).map(Number).sort((a, c) => a - c), [3, 6, 9, 12], b.name);
    for (const n of INSTALLMENT_COUNTS) assert.ok(typeof b.rates[n] === "number" && Number.isFinite(b.rates[n]) && b.rates[n] > 0, `${b.name} ${n}`);
    assert.ok(BANK_LOGOS[b.id], `${b.name} logosu`);
  }
});

test("başlangıç oranları ve Türkçe biçim", () => {
  const r = INSTALLMENT_BANKS[0].rates;
  assert.deepEqual([r[3], r[6], r[9], r[12]], [5.87, 11.47, 17.22, 23.02]);
  assert.equal(formatRate(5.87), "%5,87");
});

test("Kuveyt Türk taksit tablosunda yok, logosu var", () => {
  assert.ok(!INSTALLMENT_BANKS.some((b) => /kuveyt/i.test(b.id + b.name)));
  assert.ok(BANK_LOGOS.kuveytturk);
});

test("isKuveytTurk: büyük/küçük harf ve Türkçe karakter farkı", () => {
  for (const s of ["Kuveyt Türk", "KUVEYT TÜRK", "kuveyt turk", " Kuveyt  Türk "]) assert.ok(isKuveytTurk(s), s);
  assert.ok(!isKuveytTurk("Ziraat"));
});
