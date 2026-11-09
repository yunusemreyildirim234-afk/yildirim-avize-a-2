import test from "node:test";
import assert from "node:assert/strict";
import { isUnderpaid, reportLatePayment } from "../lib/late-payment.ts";

const info = { merchantOid: "OID1", orderId: "abcdef12-3456", orderStatus: "CANCELLED", payStatus: "success", siteUrl: "https://x.test" };
const mkDeps = (alreadyReported) => {
  const calls = { panel: 0, mail: 0 };
  return {
    calls,
    deps: {
      log: () => {},
      warn: () => {},
      notifyAdmins: async () => { calls.panel++; },
      loadOrder: async () => null,
      emailAdmin: async () => { calls.mail++; return true; },
      alreadyReported,
    },
  };
};

test("eksik tutar: yalnızca sipariş toplamından küçükse; eşit, fazla (vade farkı) ve geçersiz değer değil", () => {
  assert.equal(isUnderpaid("9999", 100), true);
  assert.equal(isUnderpaid("10000", 100), false);
  assert.equal(isUnderpaid("12000", 100), false);
  assert.equal(isUnderpaid("abc", 100), false);
  assert.equal(isUnderpaid("12345", 123.45), false, "kuruş yuvarlaması");
});

test("iptal edilmiş siparişe ilk geç success uyarı üretir, sonrakiler üretmez", async () => {
  const first = mkDeps(async () => false);
  assert.equal(await reportLatePayment(first.deps, info), true);
  assert.deepEqual(first.calls, { panel: 1, mail: 1 });
  const repeat = mkDeps(async () => true);
  assert.equal(await reportLatePayment(repeat.deps, info), false);
  assert.deepEqual(repeat.calls, { panel: 0, mail: 0 });
});

test("uyarı kontrolü hata verirse uyarı yine gider", async () => {
  const { deps, calls } = mkDeps(async () => { throw new Error("db"); });
  assert.equal(await reportLatePayment(deps, info), true);
  assert.deepEqual(calls, { panel: 1, mail: 1 });
});
