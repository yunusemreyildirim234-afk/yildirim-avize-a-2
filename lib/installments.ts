// Taksit oran tablosu ve tahmini taksit tutarı hesaplama yardımcıları.
// Projede canlı PayTR `taksit-oranlari` servisi tanımlı olmadığından güncel PayTR oranları
// tek merkezden (bu saf modülden) yönetilir; ödeme/sipariş fiyatlandırma kodundan bağımsızdır.
//
// >>> ORANLARI BURADAN DEĞİŞTİR <<<
// Her bankanın `rates` nesnesinde anahtar taksit sayısı, değer komisyon yüzdesidir (4.17 = %4,17).
// Bir bankaya özel oran yazmak için yalnızca o bankanın satırındaki sayıları değiştir.
// Kuveyt Türk tabloda yer almaz; logosu yalnızca Havale/EFT bilgisinde kullanılır (BANK_LOGOS.kuveytturk).

export const INSTALLMENT_COUNTS = [2, 3, 6, 9, 12] as const;
export type InstallmentCount = (typeof INSTALLMENT_COUNTS)[number];

export const PAYTR_DEFAULT_RATES: Record<InstallmentCount, number> = {
  2: 4.17,
  3: 6.24,
  6: 12.96,
  9: 20.8,
  12: 29.9,
};

export interface InstallmentBank {
  id: string;
  name: string;
  rates: Record<InstallmentCount, number>;
}

export const INSTALLMENT_BANKS: readonly InstallmentBank[] = [
  { id: "axess", name: "Axess", rates: { 2: 4.17, 3: 6.24, 6: 12.96, 9: 20.8, 12: 29.9 } },
  { id: "bonus", name: "Bonus", rates: { 2: 4.17, 3: 6.24, 6: 12.96, 9: 20.8, 12: 29.9 } },
  { id: "qnb", name: "QNB", rates: { 2: 4.17, 3: 6.24, 6: 12.96, 9: 20.8, 12: 29.9 } },
  { id: "paraf", name: "Paraf", rates: { 2: 4.17, 3: 6.24, 6: 12.96, 9: 20.8, 12: 29.9 } },
  { id: "advantage", name: "Advantage", rates: { 2: 4.17, 3: 6.24, 6: 12.96, 9: 20.8, 12: 29.9 } },
  { id: "maximum", name: "Maximum", rates: { 2: 4.17, 3: 6.24, 6: 12.96, 9: 20.8, 12: 29.9 } },
  { id: "saglamkart", name: "Sağlam Kart", rates: { 2: 4.17, 3: 6.24, 6: 12.96, 9: 20.8, 12: 29.9 } },
  { id: "world", name: "World", rates: { 2: 4.17, 3: 6.24, 6: 12.96, 9: 20.8, 12: 29.9 } },
  { id: "bankkart", name: "Bankkart", rates: { 2: 4.17, 3: 6.24, 6: 12.96, 9: 20.8, 12: 29.9 } },
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

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** 4.17 → "%4,17" */
export const formatRate = (pct: number): string => `%${pct.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** 1062.4 → "1.062,40 ₺" */
export const formatTl = (amount: number): string => `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

export interface InstallmentCalculation {
  count: number;
  ratePct: number;
  baseAmount: number;
  monthly: number;
  total: number;
}

/**
 * Verilen peşin tutar, taksit sayısı ve komisyon yüzdesine göre aylık taksit ve toplam ödeme tutarını hesaplar.
 * Geçersiz tutar (<= 0, NaN, Infinity), geçersiz taksit sayısı (< 1, tam sayı değil) veya negatif oranda `null` döner.
 */
export function calculateInstallment(amount: number, count: number, ratePct: number): InstallmentCalculation | null {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1) return null;
  if (typeof ratePct !== "number" || !Number.isFinite(ratePct) || ratePct < 0) return null;

  const baseAmount = round2(amount);
  if (baseAmount <= 0) return null;

  const total = round2(baseAmount * (1 + ratePct / 100));
  const monthly = round2(total / count);

  return { count, ratePct, baseAmount, monthly, total };
}

/**
 * Banka kimliği ve taksit sayısına göre tablodaki oranı bulup tahmini taksit hesabı yapar.
 */
export function calculateBankInstallment(
  amount: number,
  bankId: string,
  count: InstallmentCount
): (InstallmentCalculation & { bankId: string; bankName: string }) | null {
  const bank = INSTALLMENT_BANKS.find((b) => b.id === bankId);
  if (!bank) return null;
  const ratePct = bank.rates[count];
  const calc = calculateInstallment(amount, count, ratePct);
  if (!calc) return null;
  return { ...calc, bankId: bank.id, bankName: bank.name };
}

/** Banka adı "Kuveyt Türk" mü? (büyük/küçük harf ve Türkçe karakter farkı gözetmez) */
export const isKuveytTurk = (name: string): boolean =>
  name.trim().toLocaleLowerCase("tr-TR").replace(/ü/g, "u").replace(/ı/g, "i").replace(/\s+/g, " ") === "kuveyt turk";

