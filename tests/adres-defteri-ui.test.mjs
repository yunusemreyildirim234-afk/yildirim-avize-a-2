import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Hesabım sayfası adres defterini gösterir (ProfileName'den sonra, hesap adıyla)", () => {
  const g = src("app/giris/page.tsx");
  assert.match(g, /import AddressBook from "@\/components\/AddressBook"/);
  assert.match(g, /<AddressBook defaultName=\{user\.name\} \/>/);
  assert.ok(g.indexOf("<ProfileName") < g.indexOf("<AddressBook"));
});

test("AddressBook: ekle (POST), düzenle ve varsayılan yap (PATCH), sil (DELETE); sınır ve telefon doğrulaması paylaşılan modüllerden", () => {
  const c = src("components/AddressBook.tsx");
  assert.match(c, /"\/api\/user\/addresses"/);
  assert.match(c, /method: id \? "PATCH" : "POST"/);
  assert.match(c, /method: "DELETE"/);
  assert.match(c, /isDefault: true/);
  assert.match(c, /import \{ MAX_ADDRESSES \} from "@\/lib\/address-book"/);
  assert.match(c, /import \{ isValidPhone, PHONE_ERROR \} from "@\/lib\/phone"/);
  assert.match(c, /locations\?stateId=\$\{stateId\}/); // ilçeler il değişince yüklenir
  assert.match(c, /data-testid="kayitli-adres"/);
  assert.match(c, /confirm\(/); // silmeden önce onay
});

test("admin sayfalarında müşteri adres listesi yok", () => {
  for (const f of ["app/admin/page.tsx", "app/admin/siparis/[id]/page.tsx", "lib/admin-order-detail.ts", "lib/activity.ts"]) {
    assert.ok(!/prisma\.address|api\/user\/addresses|AddressBook/.test(src(f)), f);
  }
});
