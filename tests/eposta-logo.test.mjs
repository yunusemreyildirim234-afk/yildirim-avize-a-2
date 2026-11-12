import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const email = readFileSync(new URL("../lib/email.ts", import.meta.url), "utf8");

test("e-posta logosu mutlak https adresli, 200 px ve alt metinli", () => {
  const logo = email.match(/EMAIL_LOGO_HTML = `([^`]*)`/)?.[1] ?? "";
  assert.match(logo, /src="https:\/\/www\.yildirimavize\.com\.tr\/email-logo-v3.png"/);
  assert.match(logo, /width="200"/);
  assert.match(logo, /alt="Yıldırım Avize"/);
});

test("logo tek yerden, ortak gönderim fonksiyonunda html'in en başına eklenir", () => {
  const send = email.slice(email.indexOf("async function sendViaResend"), email.indexOf("/** Tutar dökümü"));
  assert.match(send, /html: EMAIL_LOGO_HTML \+ payload\.html/);
  assert.equal((email.match(/EMAIL_LOGO_HTML \+/g) ?? []).length, 1);
});
