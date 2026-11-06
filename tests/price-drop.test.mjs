import test from "node:test";
import assert from "node:assert/strict";
import { shouldNotifyPriceDrop, shouldEmailPriceDrop, priceDropMessage, PRICE_DROP_MAX_EMAILS } from "../lib/price-drop.ts";

const now = new Date("2026-11-06T12:00:00Z");
const ago = (h) => new Date(now.getTime() - h * 3600_000);

test("fiyat düşüşünde bildirir; artışta, aynı fiyatta ve kuruş altı farkta bildirmez", () => {
  assert.equal(shouldNotifyPriceDrop(1000, 800, null, now), true);
  assert.equal(shouldNotifyPriceDrop(800, 1000, null, now), false);
  assert.equal(shouldNotifyPriceDrop(800, 800, null, now), false);
  assert.equal(shouldNotifyPriceDrop(800.005, 800, null, now), false);
  assert.equal(shouldNotifyPriceDrop(NaN, 800, null, now), false);
  assert.equal(shouldNotifyPriceDrop(1000, -1, null, now), false);
});

test("24 saat içinde ikinci düşüş bildirilmez; 24 saat sonra bildirilir", () => {
  assert.equal(shouldNotifyPriceDrop(1000, 800, ago(2), now), false);
  assert.equal(shouldNotifyPriceDrop(1000, 800, ago(23.9), now), false);
  assert.equal(shouldNotifyPriceDrop(1000, 800, ago(24), now), true);
  assert.equal(shouldNotifyPriceDrop(1000, 800, ago(48), now), true);
});

test("e-posta: onay kapalıyken, bildirim yokken ve 50 alıcıyı aşınca gitmez", () => {
  assert.equal(shouldEmailPriceDrop({ notify: true, consent: true, recipientCount: 1 }), true);
  assert.equal(shouldEmailPriceDrop({ notify: true, consent: false, recipientCount: 1 }), false);
  assert.equal(shouldEmailPriceDrop({ notify: false, consent: true, recipientCount: 1 }), false);
  assert.equal(shouldEmailPriceDrop({ notify: true, consent: true, recipientCount: PRICE_DROP_MAX_EMAILS }), true);
  assert.equal(shouldEmailPriceDrop({ notify: true, consent: true, recipientCount: PRICE_DROP_MAX_EMAILS + 1 }), false);
});

test("bildirim metni", () => {
  assert.equal(priceDropMessage("Kontes", 1000, 800), "Favorinizdeki Kontes ürününün fiyatı 1.000,00 ₺ → 800,00 ₺ oldu");
});
