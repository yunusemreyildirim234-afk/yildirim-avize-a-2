import test from "node:test";
import assert from "node:assert/strict";
import { titleCaseTr } from "../lib/display-case.ts";

test("Türkçe kurala göre kelime başları büyür (i → İ, ı → I)", () => {
  assert.equal(titleCaseTr("beyoğlu istanbul"), "Beyoğlu İstanbul");
  assert.equal(titleCaseTr("ışık sokak no:5"), "Işık Sokak No:5");
});

test("mevcut büyük harfler ve sayılar korunur; ayraçlardan sonra büyür", () => {
  assert.equal(titleCaseTr("Şişhane Cad. 12/a (ikinci kat)"), "Şişhane Cad. 12/A (İkinci Kat)");
  assert.equal(titleCaseTr("MERKEZ mah"), "MERKEZ Mah");
  assert.equal(titleCaseTr(""), "");
});
