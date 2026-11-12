import test from "node:test";
import assert from "node:assert/strict";
import { displayTitle } from "../lib/title-display.ts";

test("(TAM MONTAJLIDIR.) ayıklanır ve montajlı işaretlenir", () => {
  assert.deepEqual(displayTitle("10 Lu Kontes Yemek Masası Avizesi Gold (TAM MONTAJLIDIR.)"), { title: "10 Lu Kontes Yemek Masası Avizesi Gold", assembled: true });
  assert.equal(displayTitle("Kontes Gold ( tam montajlıdır. )").assembled, true);
});

test("ek yoksa başlık aynen döner; art arda çağrıda sonuç değişmez", () => {
  const t = "Kristal Avize 6 Lı Modern (Led Ampul Hediye)";
  assert.deepEqual(displayTitle(t), { title: t, assembled: false });
  const m = "A (TAM MONTAJLIDIR.)";
  assert.deepEqual(displayTitle(m), displayTitle(m));
});

test("başlık yalnızca ekten oluşuyorsa boş bırakılmaz", () => {
  assert.equal(displayTitle("(TAM MONTAJLIDIR.)").title, "(TAM MONTAJLIDIR.)");
});

test("sondaki tüm montajlı kalıpları ayıklanır ve rozet çıkar", () => {
  for (const ek of ["(TAM MONTAJLIDIR.)", "( Tam montajlı)", "(TAM MONTAJLI)", "(Tam Montajlıdır)", "(Tam montajlı )", "(tam montajlıdır)", "( TAM MONTAJLIDIR. )", "(TAM MONTAJLIDIR)"]) {
    assert.deepEqual(displayTitle(`10 Lu Kontes Avize Gold ${ek}`), { title: "10 Lu Kontes Avize Gold", assembled: true }, ek);
  }
  assert.equal(displayTitle("Kontes Avize(Tam Montajlı)").title, "Kontes Avize");
});

test("başka içerikli parantezler ve ortadaki 'montajlı' olduğu gibi kalır", () => {
  for (const t of [
    "Avize Gold ( 8+4 )",
    "Avize Gold ( Led Ampuller Hediye)",
    "Avize Gold ( Led Ampul Hediye )",
    "Avize Taşı (metal halka hediye)",
    "Avize (TAM MONTAJLIDIR.) Gold",
    "Tam Montajlı Avize Gold",
    "Avize Gold (TAM MONTAJLIDIR.) ( Led Ampuller Hediye)",
    "Avize (Tam montajlı ve ampullü)",
  ]) assert.deepEqual(displayTitle(t), { title: t, assembled: false }, t);
});
