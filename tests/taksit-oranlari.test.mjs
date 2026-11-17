import test from "node:test";
import assert from "node:assert/strict";
import {
  BANK_LOGOS,
  calculateBankInstallment,
  calculateInstallment,
  formatRate,
  formatTl,
  INSTALLMENT_BANKS,
  INSTALLMENT_COUNTS,
  isKuveytTurk,
  PAYTR_DEFAULT_RATES,
} from "../lib/installments.ts";

test("9 banka, her birinde 2/3/6/9/12 taksit satırı ve güncel PayTR oranları", () => {
  assert.equal(INSTALLMENT_BANKS.length, 9);
  assert.deepEqual([...INSTALLMENT_COUNTS], [2, 3, 6, 9, 12]);
  for (const b of INSTALLMENT_BANKS) {
    assert.deepEqual(
      Object.keys(b.rates).map(Number).sort((a, c) => a - c),
      [2, 3, 6, 9, 12],
      b.name
    );
    for (const n of INSTALLMENT_COUNTS) {
      assert.ok(typeof b.rates[n] === "number" && Number.isFinite(b.rates[n]) && b.rates[n] > 0, `${b.name} ${n}`);
      assert.equal(b.rates[n], PAYTR_DEFAULT_RATES[n], `${b.name} ${n} oranı`);
    }
    assert.ok(BANK_LOGOS[b.id], `${b.name} logosu`);
  }
});

test("güncel PayTR oranları ve Türkçe biçimlendirme", () => {
  const r = INSTALLMENT_BANKS[0].rates;
  assert.deepEqual([r[2], r[3], r[6], r[9], r[12]], [4.17, 6.24, 12.96, 20.8, 29.9]);
  assert.equal(formatRate(4.17), "%4,17");
  assert.equal(formatRate(6.24), "%6,24");
  assert.equal(formatRate(12.96), "%12,96");
  assert.equal(formatRate(20.8), "%20,80");
  assert.equal(formatRate(29.9), "%29,90");
  assert.equal(formatTl(1062.4), "1.062,40 ₺");
});

test("calculateInstallment: farklı taksit oranları ve kuruş yuvarlama", () => {
  // 1.000 TL için 2, 3, 6, 9, 12 taksit
  assert.deepEqual(calculateInstallment(1000, 2, 4.17), {
    count: 2,
    ratePct: 4.17,
    baseAmount: 1000,
    total: 1041.7,
    monthly: 520.85,
  });
  // 1062.40 / 3 = 354.1333... -> 354.13
  assert.deepEqual(calculateInstallment(1000, 3, 6.24), {
    count: 3,
    ratePct: 6.24,
    baseAmount: 1000,
    total: 1062.4,
    monthly: 354.13,
  });
  // 1129.60 / 6 = 188.2666... -> 188.27
  assert.deepEqual(calculateInstallment(1000, 6, 12.96), {
    count: 6,
    ratePct: 12.96,
    baseAmount: 1000,
    total: 1129.6,
    monthly: 188.27,
  });
  // 1208.00 / 9 = 134.2222... -> 134.22
  assert.deepEqual(calculateInstallment(1000, 9, 20.8), {
    count: 9,
    ratePct: 20.8,
    baseAmount: 1000,
    total: 1208,
    monthly: 134.22,
  });
  // 1299.00 / 12 = 108.25
  assert.deepEqual(calculateInstallment(1000, 12, 29.9), {
    count: 12,
    ratePct: 29.9,
    baseAmount: 1000,
    total: 1299,
    monthly: 108.25,
  });

  // Küsuratlı tutar yuvarlama: 1499.90 * 1.0624 = 1593.49376 -> 1593.49; / 3 = 531.1633... -> 531.16
  assert.deepEqual(calculateInstallment(1499.9, 3, 6.24), {
    count: 3,
    ratePct: 6.24,
    baseAmount: 1499.9,
    total: 1593.49,
    monthly: 531.16,
  });

  // %0 komisyon oranı
  assert.deepEqual(calculateInstallment(900, 3, 0), {
    count: 3,
    ratePct: 0,
    baseAmount: 900,
    total: 900,
    monthly: 300,
  });
});

test("calculateInstallment: geçersiz tutar, taksit sayısı ve oranlarda null döner", () => {
  for (const invalidAmount of [0, -1, -250.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0.001]) {
    assert.equal(calculateInstallment(invalidAmount, 3, 6.24), null, `amount=${invalidAmount}`);
  }
  for (const invalidCount of [0, -3, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(calculateInstallment(1000, invalidCount, 6.24), null, `count=${invalidCount}`);
  }
  for (const invalidRate of [-0.01, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(calculateInstallment(1000, 3, invalidRate), null, `rate=${invalidRate}`);
  }
});

test("calculateBankInstallment: seçili kart ve taksit için doğru hesap döner", () => {
  const res = calculateBankInstallment(2500, "bonus", 6);
  assert.deepEqual(res, {
    bankId: "bonus",
    bankName: "Bonus",
    count: 6,
    ratePct: 12.96,
    baseAmount: 2500,
    total: 2824,
    monthly: 470.67,
  });
  assert.equal(calculateBankInstallment(2500, "olmayan-banka", 6), null);
  assert.equal(calculateBankInstallment(0, "axess", 3), null);
});

test("Kuveyt Türk taksit tablosunda yok, logosu var", () => {
  assert.ok(!INSTALLMENT_BANKS.some((b) => /kuveyt/i.test(b.id + b.name)));
  assert.ok(BANK_LOGOS.kuveytturk);
});

test("isKuveytTurk: büyük/küçük harf ve Türkçe karakter farkı", () => {
  for (const s of ["Kuveyt Türk", "KUVEYT TÜRK", "kuveyt turk", " Kuveyt  Türk "]) assert.ok(isKuveytTurk(s), s);
  assert.ok(!isKuveytTurk("Ziraat"));
});
