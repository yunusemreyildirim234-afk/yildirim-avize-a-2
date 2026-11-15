// Dosya tabanlı referanslar (YALNIZ OKUR): araç manifesti, geri-al yedekleri ve depo kaynağında sabit yazılmış Blob adresleri.
// Bunlarda geçen her adres KORUNAN sayılır.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { metindenYollar } from "./yetim-cekirdek.mjs";

const ATLA = new Set(["node_modules", ".next", ".git", ".vercel", "test-results", "playwright-report"]);
const UZANTI = /\.(ts|tsx|js|mjs|cjs|json|md|css|sql|html|txt)$/i;
const EN_BUYUK = 8 * 1024 * 1024;

function yuru(dizin, kok, topla) {
  let girdiler;
  try {
    girdiler = readdirSync(dizin, { withFileTypes: true });
  } catch {
    return;
  }
  for (const g of girdiler) {
    if (ATLA.has(g.name)) continue;
    const tam = join(dizin, g.name);
    if (g.isDirectory()) yuru(tam, kok, topla);
    else if (g.isFile() && UZANTI.test(g.name)) topla(tam);
  }
}

/**
 * @param {string} kokDizin  depo kökü
 * @param {string} gorselDizin  tools/gorsel (manifest ve yedek dosyaları burada/cikti'da)
 * @returns {Map<string,string>} yol → kaynak dosya (ilk görülen)
 */
export function dosyaReferanslari(kokDizin, gorselDizin) {
  const harita = new Map();
  yuru(kokDizin, kokDizin, (dosya) => {
    try {
      if (statSync(dosya).size > EN_BUYUK) return;
      for (const y of metindenYollar(readFileSync(dosya, "utf8"))) if (!harita.has(y)) harita.set(y, dosya.slice(kokDizin.length + 1));
    } catch {
      /* okunamayan dosya atlanır */
    }
  });
  // tools/gorsel/cikti git'te yok (manifest, yedekler burada olabilir): ayrıca taranır
  yuru(join(gorselDizin, "cikti"), gorselDizin, (dosya) => {
    try {
      for (const y of metindenYollar(readFileSync(dosya, "utf8"))) if (!harita.has(y)) harita.set(y, `tools/gorsel/cikti/${dosya.slice(join(gorselDizin, "cikti").length + 1)}`);
    } catch {
      /* atla */
    }
  });
  return harita;
}
