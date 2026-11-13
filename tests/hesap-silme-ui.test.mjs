import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Hesabım: hesap silme bölümü sayfaya bağlı, ConfirmDialog kullanır, window.confirm yok", () => {
  const ui = read("components/AccountDeletion.tsx");
  assert.match(ui, /ConfirmDialog/);
  assert.doesNotMatch(ui, /\bconfirm\(|window\.confirm|\balert\(/);
  assert.match(read("app/giris/page.tsx"), /<AccountDeletion \/>/);
});

test("aydınlatma metni: hesap silme talebi ve yasal saklama cümlesi var", () => {
  const src = read("app/aydinlatma-metni/page.tsx");
  assert.match(src, /Hesabınızı Hesabım sayfasından silme talebiyle de kapatabilirsiniz; siparişleriniz ve faturalarınız yasal saklama süresince anonimleştirilmiş hesapla tutulur\./);
});
