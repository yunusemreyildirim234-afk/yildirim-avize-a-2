import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanControlChars } from "../lib/validation.ts";
import { cleanAddressInput } from "../lib/address-book.ts";

test("A14: kontrol karakterleri (NUL dahil) boşluğa çevrilir ve sadeleşir", () => {
  assert.equal(cleanControlChars("Ayşe\u0000Yılmaz"), "Ayşe Yılmaz");
  assert.equal(cleanControlChars("  Ali\t\n\u0007Veli\u007F "), "Ali Veli");
  assert.equal(cleanControlChars("\u0000\u0001"), "");
  assert.equal(cleanControlChars("Ömer Yıldırım"), "Ömer Yıldırım");
});

test("A14: adres defteri ad alanı temizlenir; yalnız kontrol karakterinden oluşan ad 400 (ok:false)", () => {
  const base = { phone: "05321234567", address: "Şişhane Cad. No:1 Beyoğlu", stateId: 34, stateName: "İSTANBUL", cityId: 425, cityName: "BEYOĞLU" };
  const ok = cleanAddressInput({ ...base, fullName: "Ayşe\u0000 Yılmaz" });
  assert.equal(ok.ok, true);
  assert.equal(ok.data.fullName, "Ayşe Yılmaz");
  const bad = cleanAddressInput({ ...base, fullName: "\u0000\u0000" });
  assert.equal(bad.ok, false);
});

test("A14: sipariş ucu adı temizleyip kullanır (ham ad kayda/Kargonomi'ye gitmez)", () => {
  const route = readFileSync(new URL("../app/api/order/route.ts", import.meta.url), "utf8");
  assert.match(route, /const name = cleanControlChars\(rawName\)/);
  assert.ok(route.indexOf("cleanControlChars(rawName)") < route.indexOf("shippingFormError({ name"), "temizlik form denetiminden önce");
  assert.doesNotMatch(route, /\bname\b\s*[,}]\s*=\s*body/);
});
