import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { MAX_INPUT_PIXELS, processProductImage } from "../lib/product-image-process.ts";

test("A11: giriş piksel sınırı 40 MP; sınırı aşan görsel işlenmeden reddedilir, normal görsel işlenir", async () => {
  assert.equal(MAX_INPUT_PIXELS, 40_000_000);
  // 7000×6000 = 42 MP (düz renk PNG küçüktür): reddedilmeli
  const big = await sharp({ create: { width: 7000, height: 6000, channels: 3, background: "#fff" } }).png({ compressionLevel: 9 }).toBuffer();
  await assert.rejects(() => processProductImage(big));
  const ok = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#c33" } }).jpeg().toBuffer();
  const out = await processProductImage(ok);
  assert.ok(out.big.length > 0 && out.small.length > 0);
});
