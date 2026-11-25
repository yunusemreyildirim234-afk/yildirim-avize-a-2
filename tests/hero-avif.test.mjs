import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("görsel ayarları: AVIF önce, WebP yedek; izinli kaliteler 60 ve 75", () => {
  const images = read("next.config.ts").match(/\r?\n  images: \{\r?\n[\s\S]*?\r?\n  \},/)?.[0] ?? "";
  assert.match(images, /\r?\n\s+formats: \["image\/avif", "image\/webp"\],\r?\n/);
  assert.match(images, /\r?\n\s+qualities: \[60, 75\],\r?\n/);
});

test("hero görseli kalite 60 ile istenir", () => {
  const img = read("components/Hero.tsx").match(/<Image\r?\n[\s\S]*?\/>/)?.[0] ?? "";
  assert.match(img, /\r?\n\s+quality=\{60\}\r?\n/);
});
