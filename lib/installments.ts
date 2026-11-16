// Taksit oran tablosu (yalnızca GÖSTERİM; hiçbir tutar hesabı yapılmaz, ödeme/fiyat koduna bağlı değildir).
//
// >>> ORANLARI BURADAN DEĞİŞTİR <<<
// Her bankanın `rates` nesnesinde anahtar taksit sayısı, değer komisyon yüzdesidir (5.87 = %5,87).
// Bir bankaya özel oran yazmak için yalnızca o bankanın satırındaki sayıları değiştir.
// Kuveyt Türk tabloda yer almaz; logosu yalnızca Havale/EFT bilgisinde kullanılır (BANK_LOGOS.kuveytturk).

export const INSTALLMENT_COUNTS = [3, 6, 9, 12] as const;
export type InstallmentCount = (typeof INSTALLMENT_COUNTS)[number];

export interface InstallmentBank {
  id: string;
  name: string;
  rates: Record<InstallmentCount, number>;
}


export const INSTALLMENT_BANKS: readonly InstallmentBank[] = [
  { id: "axess", name: "Axess", rates: { 3: 5.87, 6: 11.47, 9: 17.22, 12: 23.02 } },
  { id: "bonus", name: "Bonus", rates: { 3: 5.87, 6: 11.47, 9: 17.22, 12: 23.02 } },
  { id: "qnb", name: "QNB", rates: { 3: 5.87, 6: 11.47, 9: 17.22, 12: 23.02 } },
  { id: "paraf", name: "Paraf", rates: { 3: 5.87, 6: 11.47, 9: 17.22, 12: 23.02 } },
  { id: "advantage", name: "Advantage", rates: { 3: 5.87, 6: 11.47, 9: 17.22, 12: 23.02 } },
  { id: "maximum", name: "Maximum", rates: { 3: 5.87, 6: 11.47, 9: 17.22, 12: 23.02 } },
  { id: "saglamkart", name: "Sağlam Kart", rates: { 3: 5.87, 6: 11.47, 9: 17.22, 12: 23.02 } },
  { id: "world", name: "World", rates: { 3: 5.87, 6: 11.47, 9: 17.22, 12: 23.02 } },
  { id: "bankkart", name: "Bankkart", rates: { 3: 5.87, 6: 11.47, 9: 17.22, 12: 23.02 } },
];

/** Logo dosyaları (public/taksit). Tabloda olmayan Kuveyt Türk da buradadır. Yeni banka logosu eklerken dosyayı public/taksit'e koy. */
export const BANK_LOGOS: Record<string, { src: string; name: string }> = {
  axess: { src: "/taksit/axess.png", name: "Axess" },
  bonus: { src: "/taksit/bonus.png", name: "Bonus" },
  qnb: { src: "/taksit/qnb.svg", name: "QNB" },
  paraf: { src: "/taksit/paraf.jpg", name: "Paraf" },
  advantage: { src: "/taksit/advantage.jpg", name: "Advantage" },
  maximum: { src: "/taksit/maximum.png", name: "Maximum" },
  saglamkart: { src: "/taksit/saglamkart.png", name: "Sağlam Kart" },
  world: { src: "/taksit/world.webp", name: "World" },
  bankkart: { src: "/taksit/bankkart.png", name: "Bankkart" },
  kuveytturk: { src: "/taksit/kuveytturk.png", name: "Kuveyt Türk" },
};

/** 5.87 → "%5,87" */
export const formatRate = (pct: number): string => `%${pct.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Banka adı "Kuveyt Türk" mü? (büyük/küçük harf ve Türkçe karakter farkı gözetmez) */
export const isKuveytTurk = (name: string): boolean =>
  name.trim().toLocaleLowerCase("tr-TR").replace(/ü/g, "u").replace(/ı/g, "i").replace(/\s+/g, " ") === "kuveyt turk";

