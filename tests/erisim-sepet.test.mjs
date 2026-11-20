import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync(new URL("../app/sepet/page.tsx", import.meta.url), "utf8");

test("sepet: adet ve kaldır düğmeleri ürün adını içeren erişilebilir ad taşır", () => {
  assert.match(s, /aria-label=\{`Adedi azalt: \$\{item\.title\}`\}/);
  assert.match(s, /aria-label=\{`Adedi artır: \$\{item\.title\}`\}/);
  assert.match(s, /aria-label=\{`Kaldır: \$\{item\.title\}`\}/);
});

test("sepet: kupon etiketi input'a bağlı; ödeme yöntemi radiogroup", () => {
  assert.match(s, /<label htmlFor="kupon-kodu"/);
  assert.match(s, /<input id="kupon-kodu" aria-label="Kupon kodu"/);
  assert.match(s, /role="radiogroup" aria-label="Ödeme yöntemi"/);
  assert.equal((s.match(/role="radio"/g) ?? []).length, 2);
  assert.match(s, /aria-checked=\{paymentMethod === "CREDIT_CARD"\}/);
  assert.match(s, /aria-checked=\{paymentMethod === "BANK_TRANSFER"\}/);
});

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("odak tuzağı kancası: Esc, Tab döngüsü, odağı tetikleyiciye geri verme; dört yerde kullanılır", () => {
  const hook = read("components/useFocusTrap.ts");
  assert.match(hook, /e\.key === "Escape"/);
  assert.match(hook, /e\.key !== "Tab"/);
  assert.match(hook, /opener\?\.focus\?\.\(\)/);
  for (const f of ["ConfirmDialog", "Navbar", "ContractModal", "NavSearch"]) {
    assert.match(read(`components/${f}.tsx`), /useFocusTrap\(/, f);
  }
});

test("giriş/kayıt sekmeleri seçili durumu bildirir; sipariş süzgeci bağlantısı aria-current kullanır", () => {
  const a = read("components/AuthForms.tsx");
  assert.equal((a.match(/aria-pressed="true"/g) ?? []).length, 2);
  assert.equal((a.match(/aria-pressed="false"/g) ?? []).length, 2);
  const f = read("components/AdminOrderFilters.tsx");
  assert.doesNotMatch(f, /aria-pressed/);
  assert.match(f, /aria-current=\{active \? "true" : undefined\}/);
});

test("müşteri formlarında odak çerçevesi görünür (focus:outline-none + yalnız border yok)", () => {
  for (const f of ["components/AddressBook.tsx", "components/AuthForms.tsx", "components/CodeStep.tsx", "components/PasswordFields.tsx", "app/giris/page.tsx", "app/iletisim/page.tsx", "app/sepet/page.tsx"]) {
    const s = read(f);
    assert.doesNotMatch(s, /focus:outline-none focus:border-/, f);
    assert.match(s, /focus-visible:outline-2 focus-visible:outline-(?:amber-600|bronze-ink)/, f);
  }
});
