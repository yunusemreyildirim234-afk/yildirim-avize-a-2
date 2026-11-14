import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { LEGAL_CONTACT_EMAIL } from "@/lib/site";

export const COMPANY_DEFAULTS = {
  companyTitle: "Ömer Yıldırım - Yıldırım Avize",
  taxOffice: "Beyoğlu Vergi Dairesi",
  taxNumber: "11111111111",
  mersisNo: "0000000000000000 (Örnek MERSİS No)",
  kepAddress: "ornek@hs01.kep.tr",
  headquartersAddress: "Emekyemez Mah. İskender Cad, Nazlı Hanım Sk. No:6 D:11, Şişhane Beyoğlu / İstanbul",
  etbisUrl: "https://www.eticaret.gov.tr" as string | null,
};

/** Kurumsal unvan alanı (yönetim paneli) boşsa kullanılan yedek. */
export const BRAND_FALLBACK_TITLE = "Yıldırım Avize";

export type CompanyInfo = typeof COMPANY_DEFAULTS;
export const COMPANY_TAG = "site-config";

/** Kurumsal & yasal bilgiler (tek satır). Satır yoksa veya DB erişilemezse varsayılanlar döner. */
const readCompanyInfo = unstable_cache(
  async (): Promise<CompanyInfo> => {
    // Veritabanı hatası YAKALANMAZ: unstable_cache hatalı sonucu önbelleğe yazmaz (yer tutucu varsayılanlar 5 dk takılı kalmaz); varsayılana düşme aşağıdaki sarmalayıcıda
    const row = await prisma.siteConfig.findUnique({ where: { id: 1 } });
    if (!row) return COMPANY_DEFAULTS;
    return {
      companyTitle: row.companyTitle,
      taxOffice: row.taxOffice,
      taxNumber: row.taxNumber,
      mersisNo: row.mersisNo,
      kepAddress: row.kepAddress,
      headquartersAddress: row.headquartersAddress,
      etbisUrl: row.etbisUrl,
    };
  },
  ["site-config"],
  { tags: [COMPANY_TAG], revalidate: 300 }
);

export async function getCompanyInfo(): Promise<CompanyInfo> {
  try {
    return await readCompanyInfo();
  } catch {
    return COMPANY_DEFAULTS; // yalnızca bu istek için; önbelleğe girmez
  }
}

export interface PublicCompany {
  title: string;
  taxOffice: string;
  taxNumber: string;
  mersis: string;
  kep: string;
  address: string;
}

/** "Vergi Dairesi / No" değeri: boş parça atılır (yer tutucu vergi no gösterilmez). */
export const taxValue = (office: string, number: string) => [office, number].filter((v) => v.trim()).join(" / ");

const isReal = (v: string, placeholder: string) => Boolean(v.trim()) && v.trim() !== placeholder;

/** Yasal metinlerde gösterilecek kurumsal bilgiler; fabrika yer tutucuları (MERSİS/KEP örnekleri) boş döner. */
export function toPublicCompany(c: CompanyInfo): PublicCompany {
  return {
    title: c.companyTitle.trim() || BRAND_FALLBACK_TITLE, // unvan alanı boşsa marka adı yedeği
    taxOffice: c.taxOffice,
    taxNumber: isReal(c.taxNumber, COMPANY_DEFAULTS.taxNumber) ? c.taxNumber : "", // fabrika yer tutucusu gerçek vergi no gibi gösterilmez
    mersis: isReal(c.mersisNo, COMPANY_DEFAULTS.mersisNo) ? c.mersisNo : "",
    kep: isReal(c.kepAddress, COMPANY_DEFAULTS.kepAddress) ? c.kepAddress : "",
    address: c.headquartersAddress,
  };
}

/** "Unvan — Vergi Dairesi / No — MERSİS — KEP — Adres" tek satır. */
export function companyLine(p: PublicCompany, extra: string[] = []): string {
  return [
    p.title,
    taxValue(p.taxOffice, p.taxNumber) && `Vergi Dairesi / No: ${taxValue(p.taxOffice, p.taxNumber)}`,
    p.mersis && `MERSİS No: ${p.mersis}`,
    p.kep && `KEP: ${p.kep}`,
    `Adres: ${p.address}`,
    ...extra,
  ]
    .filter(Boolean)
    .join(" — ");
}

/** Cayma ve KVKK başvuruları için iki kanal: KEP (SiteConfig'ten; yoksa yönlendirme metni) ve e-posta. */
export function legalChannels(p: PublicCompany): string {
  const kep = p.kep ? `KEP: ${p.kep}` : "KEP: adres bilgisi sayfa altındaki \"Kurumsal & Yasal Bilgiler\" bölümünde yer almaktadır";
  return `${kep} — E-posta: ${LEGAL_CONTACT_EMAIL}`;
}
