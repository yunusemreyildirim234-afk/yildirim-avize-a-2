import { BANK_LOGOS } from "@/lib/installments";

/**
 * Banka logosu. Koyu temada arkasına küçük açık kutucuk (chip) konur; açık temada kutucuk yoktur.
 * Renk dizgeleri bilerek sabit hex: koyu mod globals.css'te bg-white/neutral ölçeklerini ters çevirir, hex çevrilmez.
 * Logo dosyası yeniden boyanmaz. Bilinmeyen kimlikte (`id`) yalnızca `fallbackName` metni gösterilir.
 */
export default function BankLogo({ id, fallbackName, height = 24, className = "" }: { id: string; fallbackName?: string; height?: number; className?: string }) {
  const logo = BANK_LOGOS[id];
  if (!logo) return fallbackName ? <span className={className}>{fallbackName}</span> : null;
  return (
    <span className={`inline-flex items-center rounded-md dark:bg-[#ffffff] dark:px-1.5 dark:py-1 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- küçük statik logo; Paraf dosyası büyük olduğundan tarayıcı küçültür */}
      <img src={logo.src} alt={logo.name} height={height} loading="lazy" decoding="async" style={{ height, width: "auto", maxWidth: "100%" }} />
    </span>
  );
}
