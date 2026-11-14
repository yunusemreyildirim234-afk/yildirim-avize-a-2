import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync(new URL("../components/FaqSection.tsx", import.meta.url), "utf8");

test("SSS iade cevabı yasal metinle uyumlu: fatura şartı yok, ambalaj 'mümkünse', cayma sayfası bağlantısı, WhatsApp değişim", () => {
  const q = s.slice(s.indexOf("Beğenmezsem iade"), s.indexOf("Kristal avizelerin temizliği"));
  assert.match(q, /mümkünse orijinal ambalajıyla/);
  assert.doesNotMatch(q, /faturası/);
  assert.doesNotMatch(q, /koşulsuz/);
  assert.match(q, /başka bir modelle değiştirebilirsiniz/);
  assert.match(q, /Değişim için WhatsApp'tan bize yazın/);
  assert.match(q, /href: "\/iptal-iade-cayma"/);
});

test("SSS: e-Arşiv ifadesi yok; yasak ifadeler eklenmedi", () => {
  assert.doesNotMatch(s, /e-Arşiv/);
  assert.match(s, /faturanızın şirketiniz adına düzenlenmesini/);
  assert.doesNotMatch(s, /sigortalı/i);
  assert.doesNotMatch(s, /SMS/);
});
