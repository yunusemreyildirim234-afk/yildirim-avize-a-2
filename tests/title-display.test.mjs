import test from "node:test";
import assert from "node:assert/strict";
import { displayTitle } from "../lib/title-display.ts";

test("(TAM MONTAJLIDIR.) ayıklanır ve montajlı işaretlenir", () => {
  assert.deepEqual(displayTitle("10 Lu Kontes Yemek Masası Avizesi Gold (TAM MONTAJLIDIR.)"), { title: "10 Lu Kontes Yemek Masası Avizesi Gold", assembled: true });
  assert.equal(displayTitle("Kontes 12 Li (TAM MONTAJLIDIR) Eskitme").title, "Kontes 12 Li Eskitme");
  assert.equal(displayTitle("Kontes ( tam montajlıdır. ) Gold").assembled, true);
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
