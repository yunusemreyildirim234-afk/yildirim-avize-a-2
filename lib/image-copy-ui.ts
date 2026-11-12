// "Görselleri depoya kopyala" düğmesi için SAF metin/kota yardımcıları (istemcide kullanılır).
// Blob yazma sayacı YOKTUR: bu ay kullanılan yazma sayısı elle girilen bir TAHMİNDİR; ay/kullanım değiştikçe güncellenmelidir.
export const BLOB_HOBBY_LIMIT = 2000;
export const BLOB_USED_ESTIMATE = 1320;

/** Kopyalama başlamadan gösterilen onay metni; kalan kota 2N'den azsa ve IMAGES "Ezerek" ise uyarı eklenir. */
export function copyConfirmText(n: number, imagesMode?: string): string {
  const writes = n * 2;
  const left = BLOB_HOBBY_LIMIT - BLOB_USED_ESTIMATE;
  let msg = `${n} görsel = ${writes} Blob yazması (Hobby ayda ${BLOB_HOBBY_LIMIT}, bu ay yaklaşık ${BLOB_USED_ESTIMATE} kullanıldı; kalan yaklaşık ${Math.max(0, left)}).`;
  if (writes > left) msg += `\n\nUYARI: ${writes} yazma tahmini kalan kotadan (${Math.max(0, left)}) fazla. Kota aşılırsa Blob deposu ay sonuna kadar kilitlenebilir. Yine de başlatmak yerine önce Durdur ile az sayıda görselle deneyebilirsiniz.`;
  if (imagesMode === "OVERWRITE") msg += `\n\nDİKKAT: Eşitlemede Görseller "Trendyol'daki değeri yaz" seçili. Sonraki eşitlemede elle eklediğiniz ya da değiştirdiğiniz görseller ezilir; Trendyol'da değişen görsel yeniden Trendyol adresiyle gelir ve tekrar kopyalanması gerekir.`;
  msg += `\n\nİşlem küçük partilerle ilerler; Durdur ile kesebilirsiniz, kaldığı yerden sürer.`;
  return msg;
}

/** Eşitleme görsel modu "Ezerek" iken düğmenin altında gösterilen kalıcı uyarı. */
export const COPY_OVERWRITE_NOTE =
  'Eşitlemede Görseller "Trendyol\'daki değeri yaz" seçili: kopyalanan adresler imageMap kaydıyla korunur, ama elle yaptığınız görsel değişiklikleri ezilir ve Trendyol\'da değişen görsel tekrar Trendyol adresiyle gelir.';
