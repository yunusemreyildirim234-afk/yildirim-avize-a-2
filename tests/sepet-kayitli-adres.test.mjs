import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const sepet = src("app/sepet/page.tsx");

test("sepet kayıtlı adresleri /api/user/addresses'ten çeker ve varsayılanı otomatik uygular (form dokunulmadıysa)", () => {
  assert.match(sepet, /fetch\("\/api\/user\/addresses"/);
  assert.match(sepet, /const def = pickDefault\(list\);\s*if \(def && !formTouched\.current\) applyAddress\(def, pickupRef\.current\);/);
  // giriş yoksa (401) boş liste: form eskisi gibi
  assert.match(sepet, /res\.ok \? res\.json\(\) : \{ addresses: \[\] \}/);
});

test("form elle değişince varsayılan adres ezmez: ad, telefon, il, ilçe, adres alanları formTouched işaretler", () => {
  assert.equal((sepet.match(/formTouched\.current = true/g) ?? []).length, 5);
  for (const field of ["setName(e.target.value)", "setPhone(e.target.value)", "setBuyerStateId(Number(e.target.value))", "setBuyerCityId(Number(e.target.value))", "setAddress(e.target.value)"]) {
    const i = sepet.indexOf(field);
    assert.ok(i > 0, field);
    assert.match(sepet.slice(Math.max(0, i - 120), i), /formTouched\.current = true/, field);
  }
});

test("ilçe seçimi liste gelince uygulanır (pendingCityId); listede yoksa 0; ilçe efekti eski yanıtı yok sayar", () => {
  assert.match(sepet, /const pendingCityId = useRef<number \| null>\(null\)/);
  assert.match(sepet, /const want = pendingCityId\.current;\s*pendingCityId\.current = null;\s*setBuyerCityId\(want && data\.cities\.some\(\(c: LocationItem\) => c\.id === want\) \? want : 0\)/);
  assert.match(sepet, /let live = true;\s*fetch\(`\/api\/kargonomi\/locations\?stateId=\$\{buyerStateId\}`\)/);
  // il aynı ve liste yüklüyse ilçe doğrudan, farklı ilde ilçe beklemeye alınır
  assert.match(sepet, /if \(citiesFor\.current === a\.stateId\) \{\s*setBuyerStateId\(a\.stateId\);\s*setBuyerCityId\(a\.cityId\);\s*\} else \{\s*pendingCityId\.current = a\.cityId;\s*setBuyerStateId\(a\.stateId\);/);
  // müşteri ili elle değiştirince bekleyen ilçe silinir
  assert.match(sepet, /pendingCityId\.current = null; setBuyerStateId\(Number\(e\.target\.value\)\)/);
});

test("'Kayıtlı adres seç' yalnızca adrese teslimde ve kayıtlı adres varsa; seçim yalnızca form state'ini doldurur (kayıtlı adres değişmez, yazma çağrısı yok)", () => {
  assert.match(sepet, /\{!isPickup && savedAddresses\.length > 0 && \(/);
  assert.match(sepet, /Kayıtlı adres seç/);
  const apply = sepet.slice(sepet.indexOf("const applyAddress"), sepet.indexOf("// Giriş yapmış üyenin kayıtlı adresleri"));
  assert.match(apply, /if \(!keepName\) setName\(a\.fullName\)/);
  assert.match(apply, /setPhone\(a\.phone\)/);
  assert.match(apply, /setAddress\(a\.address\)/);
  assert.ok(!/api\/user\/addresses`?[^)]*method/.test(sepet), "sepet adres yazmaz");
  // "Bu adresi kaydet" bilerek yok
  assert.ok(!/Bu adresi kaydet/.test(sepet));
});

test("sipariş gövdesi: sepet aynı alanları gönderir", () => {
  for (const f of ["phone,", "address: effectiveAddress,", "buyerStateId: isPickup ? 34 : buyerStateId,", "buyerCityId: isPickup ? 425 : buyerCityId,"]) assert.ok(sepet.includes(f), f);
});

test("A13: mağazadan teslimde varsayılan adres adı doldurmaz (yalnızca telefon); form elle değişince seçili adres boşalır", () => {
  assert.match(sepet, /applyAddress = useCallback\(\(a: SavedAddress, keepName = false\)/);
  assert.match(sepet, /applyAddress\(def, pickupRef\.current\)/);
  // mağazadan teslime geçince kayıtlı adresin adı hesap adına döner, seçim boşalır
  const ch = sepet.slice(sepet.indexOf("const chooseShipping"), sepet.indexOf("const sortedStates"));
  assert.match(ch, /pickupRef\.current = type === "BEYOGLU_MAGAZA_TESLIM"/);
  assert.match(ch, /name === picked\.fullName\) setName\(accountName\.current\)/);
  assert.match(ch, /setSelectedAddrId\(""\)/);
  assert.equal((sepet.match(/onChange=\{\(\) => chooseShipping\(/g) ?? []).length, 2);
  assert.ok(!/onChange=\{\(\) => setShippingType/.test(sepet));
  // her elle değişiklik seçili adresi boşaltır
  assert.equal((sepet.match(/formTouched\.current = true; setSelectedAddrId\(""\);/g) ?? []).length, 5);
});
