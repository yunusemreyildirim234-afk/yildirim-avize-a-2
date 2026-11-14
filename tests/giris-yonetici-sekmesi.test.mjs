import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../app/giris/page.tsx");

test("yönetici sekmesi yalnız ?tab=yonetici varken çizilir", () => {
  assert.match(page, /const \[adminTab, setAdminTab\] = useState\(false\)/);
  assert.match(page, /params\.get\("tab"\) === "yonetici"\) \{[^}]*setTab\("yonetici"\);[^}]*setAdminTab\(true\);/);
  assert.match(page, /\{adminTab && \(\s*<div role="tablist" aria-label="Giriş türü"/);
});

test("yönetici girişi çalışmaya devam eder: form ve uç değişmedi, yönlendirmeler aynı adrese gider", () => {
  assert.match(page, /\/api\/auth\/admin/);
  assert.match(page, /function AdminLoginForm\(\)/);
  assert.match(read("../lib/admin-guard.ts"), /redirect\("\/giris\?tab=yonetici"\)/);
  assert.match(read("../components/AdminTopBar.tsx"), /\/giris\?tab=yonetici/);
});
