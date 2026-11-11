import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanAddressInput, pickDefault, sortAddresses, shouldBeDefault, nextDefaultAfterDelete, MAX_ADDRESSES } from "../lib/address-book.ts";
import { shippingFormError } from "../lib/validation.ts";
import { isValidPhone } from "../lib/phone.ts";

const ok = { title: "Ev", fullName: "Ayşe Yılmaz", phone: "0555 123 45 67", stateId: 34, stateName: "İSTANBUL", cityId: 425, cityName: "BEYOĞLU", address: "Şişhane Mah. Nazlı Hanım Sk. No:6 D:11", isDefault: true };

test("geçerli adres temizlenir ve kabul edilir; başlık boşsa 'Adresim'", () => {
  const r = cleanAddressInput({ ...ok, title: "  Ev   evi ", fullName: "  Ayşe   Yılmaz " });
  assert.equal(r.ok, true);
  assert.equal(r.data.title, "Ev evi");
  assert.equal(r.data.fullName, "Ayşe Yılmaz");
  assert.equal(cleanAddressInput({ ...ok, title: "" }).data.title, "Adresim");
  assert.equal(cleanAddressInput({ ...ok, isDefault: "true" }).data.isDefault, false); // yalnızca gerçek true
});

test("doğrulama sipariş formuyla AYNI: ad, il/ilçe, adres ve telefon kuralları", () => {
  const cases = [
    [{ fullName: "Ayşe" }, "name"],
    [{ fullName: "A B" }, "name"],
    [{ stateId: 0 }, "state"],
    [{ stateId: "34" }, "state"],
    [{ cityId: 0 }, "city"],
    [{ address: "kısa" }, "address"],
    [{ address: "1234567890" }, "address"],
    [{ phone: "123" }, "phone"],
    [{ phone: "abc1234567890" }, "phone"],
    [{ stateName: "" }, "state"],
    [{ cityName: "" }, "state"],
    [{ title: "x".repeat(41) }, "title"],
    [{ address: "a".repeat(501) }, "address"],
  ];
  for (const [patch, field] of cases) {
    const r = cleanAddressInput({ ...ok, ...patch });
    assert.equal(r.ok, false, JSON.stringify(patch));
    assert.equal(r.field, field, JSON.stringify(patch));
  }
  // sipariş formundaki fonksiyonlarla aynı sonuç
  assert.equal(shippingFormError({ name: ok.fullName, address: ok.address, stateId: 34, cityId: 425, isPickup: false }), null);
  assert.equal(isValidPhone(ok.phone), true);
  for (const bad of [null, undefined, "x", 5, []]) assert.equal(cleanAddressInput(bad).ok, false);
});

test("varsayılan adres kuralları: ilk adres varsayılan, silince en yeni kalan varsayılan olur", () => {
  assert.equal(MAX_ADDRESSES, 10);
  assert.equal(shouldBeDefault(0, false), true);
  assert.equal(shouldBeDefault(2, false), false);
  assert.equal(shouldBeDefault(2, true), true);
  const a = (id, isDefault, t) => ({ id, isDefault, createdAt: new Date(t) });
  const list = [a("1", false, "2026-01-01"), a("2", true, "2026-01-02"), a("3", false, "2026-01-03")];
  assert.equal(pickDefault(list).id, "2");
  assert.equal(pickDefault([a("1", false, "2026-01-01")]).id, "1");
  assert.equal(pickDefault([]), null);
  assert.deepEqual(sortAddresses(list).map((x) => x.id), ["2", "3", "1"]);
  assert.equal(nextDefaultAfterDelete([a("1", false, "2026-01-01"), a("3", false, "2026-01-03")], true), "3");
  assert.equal(nextDefaultAfterDelete([a("1", false, "2026-01-01")], false), null);
  assert.equal(nextDefaultAfterDelete([], true), null);
  assert.equal(nextDefaultAfterDelete([a("1", true, "2026-01-01")], true), null); // zaten varsayılan var
});

test("şema ve SQL: yalnızca yeni Address tablosu (User'a yalnızca ters ilişki), idempotent SQL, CASCADE", () => {
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  assert.match(schema, /model Address \{[\s\S]*onDelete: Cascade[\s\S]*@@index\(\[userId\]\)/);
  assert.match(schema.slice(schema.indexOf("model User {"), schema.indexOf("model Product {")), /addresses\s+Address\[\]/);
  const sql = readFileSync(new URL("../prisma/sql/adres-defteri-ekle.sql", import.meta.url), "utf8");
  assert.match(sql, /SQL ONCE/);
  assert.match(sql, /DROP TABLE "Address"/);
  const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.match(code, /CREATE TABLE IF NOT EXISTS "Address"/);
  assert.match(code, /CREATE INDEX IF NOT EXISTS "Address_userId_idx"/);
  assert.match(code, /FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE CASCADE/);
  assert.ok(!/ALTER TABLE|DROP|UPDATE\s+"|INSERT/i.test(code), "mevcut tablolara dokunulmaz");
});
