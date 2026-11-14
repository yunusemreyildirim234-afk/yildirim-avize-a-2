import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildQuestionReceivedHtml, CONTACT_CONFIRM_DAILY_LIMIT } from "../lib/contact-confirm.ts";

test("onay e-postası mesaj metnini ve adı taşımaz; ürün adı kaçışlanır", () => {
  const html = buildQuestionReceivedHtml("0212", "Kristal <b>Avize</b>");
  assert.match(html, /Mesajınız alındı/);
  assert.doesNotMatch(html, /Sayın/);
  assert.doesNotMatch(html, /özeti/);
  assert.match(html, /Kristal &lt;b&gt;Avize&lt;\/b&gt;/);
  assert.doesNotMatch(buildQuestionReceivedHtml("0212", null), /Ürün:/);
});

test("uç: gönderici adı/mesajı onay e-postasına geçmez, günlük 3 sınır ContactMessage'tan sayılır", () => {
  const r = readFileSync(new URL("../app/api/contact/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(r, /sendQuestionReceivedEmail\(\{[^}]*(name|question)/);
  assert.match(r, /prisma\.contactMessage\.count\(/);
  assert.match(r, /sentToday <= CONTACT_CONFIRM_DAILY_LIMIT/);
  assert.equal(CONTACT_CONFIRM_DAILY_LIMIT, 3);
});
