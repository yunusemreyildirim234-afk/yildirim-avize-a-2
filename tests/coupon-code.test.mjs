import test from "node:test";
import assert from "node:assert/strict";
import {
  COUPON_CODE_FORMAT_ERROR,
  LEGACY_SHOWCASE_CODE,
  couponCodeFormatError,
  couponNotAllowedNote,
  couponPlaceholder,
  defaultCardsWithCode,
  isShowcaseCoupon,
  ladderCouponLabel,
  normalizeCouponCode,
  renamePromoCardCodes,
  staleCouponMessage,
  withShowcaseNote,
} from "../lib/coupon-code.ts";

test("normalizeCouponCode: tr-TR büyük harf, boşluksuz, ASCII", () => {
  assert.equal(normalizeCouponCode("  yildirim 10 "), "YILDIRIM10");
  assert.equal(normalizeCouponCode("yıldırım5"), "YILDIRIM5");
  assert.equal(normalizeCouponCode("şeker-10"), "SEKER-10");
  assert.equal(normalizeCouponCode("İstanbul"), "ISTANBUL");
  assert.equal(normalizeCouponCode(undefined), "");
  assert.equal(normalizeCouponCode(5), "");
});

test("normalizeCouponCode: ASCII girdide eski toUpperCase kuralıyla aynı sonuç", () => {
  for (const s of ["omer10", "Kampanya-1", "a_b-c", "YILDIRIM5"]) assert.equal(normalizeCouponCode(s), s.toUpperCase());
});

test("couponCodeFormatError: 3-32 karakter, harf/rakam/-/_", () => {
  assert.equal(couponCodeFormatError("ABC"), null);
  assert.equal(couponCodeFormatError("A_B-9"), null);
  assert.equal(couponCodeFormatError("AB"), COUPON_CODE_FORMAT_ERROR);
  assert.equal(couponCodeFormatError("A".repeat(33)), COUPON_CODE_FORMAT_ERROR);
  assert.equal(couponCodeFormatError("A".repeat(32)), null);
  assert.equal(couponCodeFormatError("AB!C"), COUPON_CODE_FORMAT_ERROR);
  assert.equal(couponCodeFormatError(""), COUPON_CODE_FORMAT_ERROR);
});

test("isShowcaseCoupon: bağlı kimlik varsa yalnızca o; yoksa eski varsayılan kod", () => {
  assert.equal(isShowcaseCoupon({ id: "a", code: "YENI10" }, "a"), true);
  assert.equal(isShowcaseCoupon({ id: "b", code: LEGACY_SHOWCASE_CODE }, "a"), false);
  assert.equal(isShowcaseCoupon({ id: "b", code: LEGACY_SHOWCASE_CODE }, null), true);
  assert.equal(isShowcaseCoupon({ id: "c", code: "BASKA" }, undefined), false);
});

test("vitrin metinleri yeni adı gösterir", () => {
  assert.equal(ladderCouponLabel("YAZ10"), "YAZ10 kuponuyla");
  assert.equal(couponPlaceholder("YAZ10"), "Promosyon kodu (YAZ10)");
  assert.equal(couponPlaceholder(null), "Promosyon kodu");
  assert.equal(couponNotAllowedNote("YAZ10"), "Bu üründe YAZ10 kuponu kullanılamamaktadır.");
  assert.equal(couponNotAllowedNote(null), "Bu üründe promosyon kodu kullanılamamaktadır.");
  assert.match(staleCouponMessage("ESKI5"), /"ESKI5" kodu artık geçerli değil; sepetinizden kaldırıldı/);
});

test("withShowcaseNote: sabit eski kod notu güncel adla değişir, diğer notlar aynı kalır", () => {
  const notes = [couponNotAllowedNote(LEGACY_SHOWCASE_CODE), "Bu üründe Havale/EFT indirimi kullanılamamaktadır."];
  assert.deepEqual(withShowcaseNote(notes, "YAZ10"), ["Bu üründe YAZ10 kuponu kullanılamamaktadır.", notes[1]]);
  assert.deepEqual(withShowcaseNote(notes, null), ["Bu üründe promosyon kodu kullanılamamaktadır.", notes[1]]);
});

test("defaultCardsWithCode: varsayılan kupon kartı güncel adı alır, diğer kartlar değişmez", () => {
  const cards = [
    { id: "kupon", kind: "COUPON", code: "YILDIRIM5" },
    { id: "kargo", kind: "SHIPPING" },
    { id: "ozel", kind: "COUPON", code: "BASKA" },
  ];
  const out = defaultCardsWithCode(cards, "YAZ10");
  assert.equal(out[0].code, "YAZ10");
  assert.equal(out[1], cards[1]);
  assert.equal(out[2].code, "BASKA");
  assert.equal(defaultCardsWithCode(cards, null), cards);
});

test("renamePromoCardCodes: yalnızca eşleşen kupon kartlarının kodu değişir", () => {
  const cfg = { featured: { count: 4 }, promoCards: [{ id: "k", kind: "COUPON", code: "yildirim5", active: true }, { id: "s", kind: "SHIPPING" }, { id: "x", kind: "COUPON", code: "BASKA" }] };
  const out = renamePromoCardCodes(cfg, "YILDIRIM5", "YAZ10");
  assert.ok(out);
  assert.equal(out.promoCards[0].code, "YAZ10");
  assert.equal(out.promoCards[2].code, "BASKA");
  assert.deepEqual(out.featured, { count: 4 });
  assert.equal(cfg.promoCards[0].code, "yildirim5"); // girdi değişmez
  assert.equal(renamePromoCardCodes(cfg, "YOK", "YAZ10"), null);
  assert.equal(renamePromoCardCodes({ featured: {} }, "A", "B"), null);
  assert.equal(renamePromoCardCodes(null, "A", "B"), null);
});
