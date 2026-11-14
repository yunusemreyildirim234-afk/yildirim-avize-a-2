import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAX_COUPON_USES, COUPON_IN_USE_ERROR, couponCreateInputError, couponDeleteBlock, createCouponSafe, promoCardsUseCode } from "../lib/admin-coupon-rules.ts";

// Sahte depo: benzersiz kod kısıtı (P2002) taklidi
function fakeStore() {
  const rows = new Map();
  return {
    rows,
    create: async (code) => {
      if (rows.has(code)) throw Object.assign(new Error("unique"), { code: "P2002" });
      rows.set(code, { code });
      return { code };
    },
  };
}

test("çift oluşturma: ikincisi 409 (500 değil), ilki kaydolur", async () => {
  const s = fakeStore();
  const a = await createCouponSafe(() => s.create("YAZ10"));
  assert.equal(a.status, 200);
  const b = await createCouponSafe(() => s.create("YAZ10"));
  assert.equal(b.status, 409);
  assert.match(b.error, /zaten mevcut/);
  assert.equal(s.rows.size, 1);
});

test("P2002 dışındaki hata aynen fırlar", async () => {
  await assert.rejects(createCouponSafe(async () => { throw new Error("bağlantı"); }), /bağlantı/);
});

test("kişiye özel e-posta: geçersiz 400 hatası, boş/geçerli serbest", () => {
  assert.match(couponCreateInputError(5, "kotu-eposta"), /e-posta/);
  assert.match(couponCreateInputError(5, "a@b"), /e-posta/);
  assert.equal(couponCreateInputError(5, "ayse@ornek.com"), null);
  assert.equal(couponCreateInputError(5, null), null);
});

test("kullanım limiti: 1..10.000.000; ötesi ve geçersiz reddedilir", () => {
  assert.equal(MAX_COUPON_USES, 10_000_000);
  assert.equal(couponCreateInputError(1, null), null);
  assert.equal(couponCreateInputError(10_000_000, null), null);
  assert.ok(couponCreateInputError(10_000_001, null));
  assert.ok(couponCreateInputError(0, null));
  assert.ok(couponCreateInputError(NaN, null));
});

test("silme: bağlı vitrin kuponu engellenir (409 mesajı), sıradan kupon silinir", () => {
  const cfg = { showcaseCouponId: "c1", homepageConfig: null };
  assert.equal(couponDeleteBlock({ id: "c1", code: "VITRIN5" }, cfg), COUPON_IN_USE_ERROR);
  assert.equal(couponDeleteBlock({ id: "c2", code: "YAZ10" }, cfg), null);
  assert.match(COUPON_IN_USE_ERROR, /önce vitrinden\/kartlardan çıkarın veya pasife alın/i);
});

test("silme: vitrine bağlanmamışsa eski varsayılan kod vitrin sayılır; ana sayfa kartında geçen kod engellenir", () => {
  assert.equal(couponDeleteBlock({ id: "x", code: "YILDIRIM5" }, { showcaseCouponId: null }), COUPON_IN_USE_ERROR);
  const cfg = { showcaseCouponId: "c1", homepageConfig: { promoCards: [{ kind: "COUPON", code: "kart7" }, { kind: "TEXT" }] } };
  assert.equal(couponDeleteBlock({ id: "c9", code: "KART7" }, cfg), COUPON_IN_USE_ERROR);
  assert.equal(couponDeleteBlock({ id: "c8", code: "BASKA" }, cfg), null);
  assert.equal(couponDeleteBlock({ id: "c8", code: "BASKA" }, null), null);
  assert.equal(promoCardsUseCode("bozuk", "A"), false);
  assert.equal(promoCardsUseCode({ promoCards: "x" }, "A"), false);
});

test("uç: oluşturma ve silme kurallara bağlı, çekirdek lib/coupons.ts kullanılmaz", () => {
  const r = readFileSync(new URL("../app/api/admin/coupons/route.ts", import.meta.url), "utf8");
  assert.match(r, /createCouponSafe\(/);
  assert.match(r, /couponCreateInputError\(maxUses, userEmail\)/);
  assert.match(r, /couponDeleteBlock\(target, cfg\)/);
  assert.match(r, /status: 409/);
  assert.doesNotMatch(r, /from "@\/lib\/coupons"/);
});
