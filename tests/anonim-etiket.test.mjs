import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_alias.mjs";

const { anonLabel } = await import("../lib/activity.ts");

test("anonim etiket: aynı id aynı, farklı id farklı etiket; biçim sabit; ham id geçmez", () => {
  const a = "3f2b8c1e-aaaa-4bbb-8ccc-123456789abc";
  const b = "9d1e0c77-aaaa-4bbb-8ccc-123456789abc";
  assert.equal(anonLabel(a), anonLabel(a));
  assert.notEqual(anonLabel(a), anonLabel(b));
  assert.match(anonLabel(a), /^Anonim [0-9A-F]{6}$/);
  assert.equal(anonLabel(a).toLowerCase().includes(a.slice(0, 8)), false);
});

test("arayüz: anonim başlık etiketi gösterir, e-posta satırı aynen kalır", () => {
  const ui = readFileSync(new URL("../components/AdminActivity.tsx", import.meta.url), "utf8");
  assert.match(ui, /r\.label \?\? "Misafir"/);
  assert.match(ui, /E-posta bilinmiyor \(anonim oturum\)/);
  assert.doesNotMatch(ui, /sessionId/);
});
