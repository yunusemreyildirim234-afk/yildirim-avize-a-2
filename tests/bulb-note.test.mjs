import test from "node:test";
import assert from "node:assert/strict";
import { bulbNoteFor } from "../lib/bulb-note.ts";

test("başlıkta ampul hediye → gift", () => {
  assert.equal(bulbNoteFor("Kontes 12 Li Yemek Masası Eskitme (TAM MONTAJLIDIR.) ( Led Ampuller Hediye)"), "gift");
  assert.equal(bulbNoteFor("1 Li Kontes Aplik Eskitme Şapkalı (LED AMPUL HEDİYE)"), "gift");
  assert.equal(bulbNoteFor("Banker Masa Lambası Eskitme Renk Kasa ,yeşil Camlı ( Orjinal Üründür) ( Led Ampul Hediye )"), "gift");
});

test("ampulle ilgisiz hediye veya sıradan ürün → not-included", () => {
  assert.equal(bulbNoteFor("10 Adet 2 cm çapında Şeffaf Boncuk Kristal Avize Taşı (metal halka hediye)"), "not-included");
  assert.equal(bulbNoteFor("Kristal Avize 6 Lı Modern"), "not-included");
});

test("Aksesuar kategorisi → none", () => {
  assert.equal(bulbNoteFor("Kristal Avize Taşı", "Aksesuar"), "none");
  assert.equal(bulbNoteFor("Kristal Avize Taşı", "AKSESUAR"), "none");
  assert.equal(bulbNoteFor("Kristal Avize 6 Lı Modern", "Kristal"), "not-included");
});
