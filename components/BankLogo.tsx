import { BANK_LOGOS } from "@/lib/installments";

/**
 * Banka logosu: her logo AYNI yükseklik kutusuna (mobil 24 px, masaüstü 28 px) object-contain ile sığar;
 * çok geniş logolar `max-w` ile sınırlanır (oran bozulmaz). `compact` Havale/EFT satırı için küçük kutudur (18 px).
 * Koyu temada arkasına sabit beyaz küçük kutucuk (chip) konur; açık temada kutucuk yoktur.
 * Renk dizgeleri bilerek sabit hex: koyu mod globals.css'te bg-white/neutral ölçeklerini ters çevirir, hex çevrilmez.
 * Logo dosyaları (public/taksit) boş kenardan kırpılmıştır; logo yeniden boyanmaz. Bilinmeyen kimlikte `fallbackName` metni gösterilir.
 */
export default function BankLogo({ id, fallbackName, compact = false, className = "", imgClassName = "max-w-[110px]" }: { id: string; fallbackName?: string; compact?: boolean; className?: string; imgClassName?: string }) {
  const logo = BANK_LOGOS[id];
  if (!logo) return fallbackName ? <span className={className}>{fallbackName}</span> : null;
  const box = compact ? "h-[18px]" : "h-6 sm:h-7";
  return (
    <span className={`inline-flex items-center rounded-md dark:bg-[#ffffff] dark:px-1.5 dark:py-1 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- küçük statik logo */}
      <img src={logo.src} alt={logo.name} loading="lazy" decoding="async" className={`${box} w-auto object-contain ${imgClassName}`} />
    </span>
  );
}
