import { capMessage, type CapInfo } from "@/lib/cart-pricing";
import { BANK_TRANSFER_DISCOUNT, PICKUP_DISCOUNT } from "@/lib/pricing";

/** Sunucu teklifindeki (/api/cart/quote) bir sepet satırının uyarı için gereken alanları. */
export interface NoticeLine {
  price: number; // kademe öncesi birim fiyat
  unitPrice: number; // kademe sonrası birim fiyat
  capInfo: CapInfo | null;
  rules: { couponAllowed: boolean; pickupPct: number | null; transferPct: number | null };
}

const f = (x: number) => x.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

/**
 * Sepet satırı uyarıları — YALNIZCA sunucu teklifinden (priceCart sonucu) üretilir; yerel/bayat veriye bakmaz.
 * - capInfo varsa ve kademe bu adette gerçekten uygulanıyorsa: "adet indirimi" metni.
 * - capInfo var ama kademe yoksa: genel toplam indirim sınırı nedeniyle (adet indirimi demeden).
 * - couponAllowed=false / Havale %0 / mağaza %0: kısa metin. Hiçbiri yoksa boş liste.
 * `quoteFresh=false` iken (teklif bu sepet durumuna ait değilse) adete bağlı sınır uyarısı gösterilmez; ürün kuralları adetten bağımsızdır.
 */
export function lineNotices(line: NoticeLine, quoteFresh: boolean): string[] {
  const out: string[] = [];
  const c = line.capInfo;
  if (quoteFresh && c) {
    const tierApplied = line.unitPrice < line.price;
    if (tierApplied) out.push(capMessage(c));
    else if (c.remainingPct > 0.005) {
      out.push(`Toplam indirim üst sınırı %${f(c.capPct)} olduğu için kupon, mağazadan teslim ve Havale indirimlerinden bu üründe toplamda en fazla %${f(Math.floor(c.remainingPct * 100) / 100)} yararlanabilirsiniz.`);
    } else out.push(`Toplam indirim üst sınırı %${f(c.capPct)} olduğu için bu üründe kupon, mağazadan teslim ve Havale indirimleri uygulanmaz.`);
  }
  const r = line.rules;
  if (!r.couponAllowed) out.push("Bu üründe kupon uygulanmaz.");
  if (r.transferPct === 0) out.push("Bu üründe Havale indirimi uygulanmaz.");
  else if (r.transferPct !== null && Math.round(BANK_TRANSFER_DISCOUNT * 100) !== r.transferPct) out.push(`Havale/EFT'de %${f(r.transferPct)} indirim.`);
  if (r.pickupPct === 0) out.push("Bu üründe mağazadan teslim indirimi uygulanmaz.");
  else if (r.pickupPct !== null && Math.round(PICKUP_DISCOUNT * 100) !== r.pickupPct) out.push(`Mağazadan teslimde %${f(r.pickupPct)} indirim.`);
  return out;
}
