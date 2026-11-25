import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("hero çizimi: yazı tipi preload edilmez (CSS ve LCP görseliyle bant genişliği yarışı yok)", () => {
  const layout = read("app/layout.tsx");
  const calls = layout.match(/\bInter\(\{[^}]*\}\)/g) ?? [];
  assert.equal(calls.length, 1);
  assert.match(calls[0], /preload: false/);
  // Türkçe karakter alt kümesi ve varsayılan swap + ölçü eşitlemeli yedek yazı tipi korunur
  assert.match(calls[0], /subsets: \["latin", "latin-ext"\]/);
  assert.doesNotMatch(calls[0], /display:|adjustFontFallback/);
});
