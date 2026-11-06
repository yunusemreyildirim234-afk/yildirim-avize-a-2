// Geliştirici denetimi: "Seçenek" varyasyon değerlerinden hangi ilk parçalar renk sayılmıyor, hangi ikinci parçalar ebat değil?
// Veritabanına BAĞLANMAZ: değerler stdin'den satır satır okunur (her satır bir variationValue).
//   node scripts/listing-degerleri-denetim.mjs < degerler.txt
// Çıkan "renk sayılmayanlar" listesinden gerçek renkler lib/listing-core.ts içindeki SECENEK_COLOR_ALLOWLIST'e eklenir.
import { readFileSync } from "node:fs";
import { auditSecenekValues, variationAttrs } from "../lib/listing-core.ts";

const values = readFileSync(0, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const rep = auditSecenekValues(values);
const colors = new Map();
const sizes = new Map();
for (const v of values) {
  const a = variationAttrs("Seçenek", v);
  if (a.c) colors.set(a.c.n, (colors.get(a.c.n) ?? 0) + 1);
  if (a.s) sizes.set(a.s.n, (sizes.get(a.s.n) ?? 0) + 1);
}
const table = (title, rows) => {
  console.log(`\n== ${title} (${rows.length}) ==`);
  for (const [k, n] of rows) console.log(`${String(n).padStart(5)}  ${k}`);
};
console.log(`${values.length} değer okundu.`);
table("Renk olarak sayılan", [...colors].sort((a, b) => b[1] - a[1]));
table("Ebat olarak sayılan", [...sizes].sort((a, b) => b[1] - a[1]));
table("Renk SAYILMAYAN ilk parçalar (izin listesinde yok)", rep.unlistedFirstParts);
table("Ebat OLMAYAN ikinci parçalar (sayı x sayı kalıbına uymuyor)", rep.nonSizeSecondParts);
