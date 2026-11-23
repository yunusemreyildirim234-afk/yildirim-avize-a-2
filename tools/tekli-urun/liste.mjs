// Toplu (liste) mod için SAF fonksiyonlar: CSV ayrıştırma ve satır doğrulama (veritabanı/dosya/ağ yok).
import { sadelestir } from "./hesapla.mjs";

export const EN_COK_SATIR = 100;
const GEREKLI = ["urun_id", "paket_adedi", "fiyat"];

/** Tırnaklı alanları destekleyen tek satır bölücü. */
function hucreler(satir, ayrac) {
  const out = [];
  let cur = "";
  let tirnak = false;
  for (let i = 0; i < satir.length; i++) {
    const c = satir[i];
    if (tirnak) {
      if (c === '"' && satir[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') tirnak = false;
      else cur += c;
    } else if (c === '"') tirnak = true;
    else if (c === ayrac) { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/**
 * CSV metni → { satirlar: [{ satir, urun_id, paket_adedi, fiyat }] } veya { hata }.
 * Ayraç başlık satırından (; ya da ,) otomatik; UTF-8 BOM kabul; boş satırlar atlanır; en çok 100 veri satırı.
 */
export function csvAyristir(metin) {
  const ham = String(metin ?? "").replace(/^﻿/, "").split(/\r?\n/);
  const bas = ham.findIndex((s) => s.trim() !== "");
  if (bas < 0) return { hata: "Liste boş: başlık satırı yok." };
  const ayrac = (ham[bas].match(/;/g) ?? []).length >= (ham[bas].match(/,/g) ?? []).length ? ";" : ",";
  const baslik = hucreler(ham[bas], ayrac).map((h) => sadelestir(h).replace(/\s+/g, "_"));
  const eksik = GEREKLI.filter((g) => !baslik.includes(g));
  if (eksik.length > 0) return { hata: `Başlık satırında eksik sütun: ${eksik.join(", ")} (gerekli: ${GEREKLI.join(", ")}).` };
  const idx = Object.fromEntries(GEREKLI.map((g) => [g, baslik.indexOf(g)]));
  const satirlar = [];
  for (let i = bas + 1; i < ham.length; i++) {
    if (ham[i].trim() === "") continue;
    const h = hucreler(ham[i], ayrac);
    if (h.every((x) => x === "")) continue;
    satirlar.push({ satir: i + 1, urun_id: h[idx.urun_id] ?? "", paket_adedi: h[idx.paket_adedi] ?? "", fiyat: h[idx.fiyat] ?? "" });
  }
  if (satirlar.length === 0) return { hata: "Listede veri satırı yok." };
  if (satirlar.length > EN_COK_SATIR) return { hata: `Listede ${satirlar.length} satır var; en çok ${EN_COK_SATIR} olabilir.` };
  return { satirlar };
}

/** Bir liste satırını doğrular. Dönüş: { hata } veya { id, n, fiyat }. */
export function satirDogrula({ urun_id, paket_adedi, fiyat }) {
  if (!String(urun_id ?? "").trim()) return { hata: "urun_id boş." };
  if (!/^\d+$/.test(String(paket_adedi ?? "")) || Number(paket_adedi) < 2) return { hata: `paket_adedi 2 veya daha büyük tam sayı olmalı: "${paket_adedi}".` };
  const f = Number(String(fiyat ?? "").replace(",", "."));
  if (!/^\d+([.,]\d+)?$/.test(String(fiyat ?? "")) || !Number.isFinite(f) || f <= 0) return { hata: `fiyat sıfırdan büyük bir sayı olmalı: "${fiyat}".` };
  return { id: String(urun_id).trim(), n: Number(paket_adedi), fiyat: f };
}
