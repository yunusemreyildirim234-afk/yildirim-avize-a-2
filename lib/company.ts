import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export const COMPANY_DEFAULTS = {
  companyTitle: "Ömer Yıldırım - Yıldırım Avize",
  taxOffice: "Beyoğlu Vergi Dairesi",
  taxNumber: "11111111111",
  mersisNo: "0000000000000000 (Örnek MERSİS No)",
  kepAddress: "ornek@hs01.kep.tr",
  headquartersAddress: "Emekyemez Mah. İskender Cad, Nazlı Hanım Sk. No:6 D:11, Şişhane Beyoğlu / İstanbul",
  etbisUrl: "https://www.eticaret.gov.tr" as string | null,
};

export type CompanyInfo = typeof COMPANY_DEFAULTS;
export const COMPANY_TAG = "site-config";

/** Kurumsal & yasal bilgiler (tek satır). Satır yoksa veya DB erişilemezse varsayılanlar döner. */
export const getCompanyInfo = unstable_cache(
  async (): Promise<CompanyInfo> => {
    const row = await prisma.siteConfig.findUnique({ where: { id: 1 } }).catch(() => null);
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

export interface PublicCompany {
  title: string;
  taxOffice: string;
  taxNumber: string;
  mersis: string;
  kep: string;
  address: string;
}

const isReal = (v: string, placeholder: string) => Boolean(v.trim()) && v.trim() !== placeholder;

/** Yasal metinlerde gösterilecek kurumsal bilgiler; fabrika yer tutucuları (MERSİS/KEP örnekleri) boş döner. */
export function toPublicCompany(c: CompanyInfo): PublicCompany {
  return {
    title: c.companyTitle,
    taxOffice: c.taxOffice,
    taxNumber: c.taxNumber,
    mersis: isReal(c.mersisNo, COMPANY_DEFAULTS.mersisNo) ? c.mersisNo : "",
    kep: isReal(c.kepAddress, COMPANY_DEFAULTS.kepAddress) ? c.kepAddress : "",
    address: c.headquartersAddress,
  };
}

/** "Unvan — Vergi Dairesi / No — MERSİS — KEP — Adres" tek satır. */
export function companyLine(p: PublicCompany, extra: string[] = []): string {
  return [
    p.title,
    `Vergi Dairesi / No: ${p.taxOffice} / ${p.taxNumber}`,
    p.mersis && `MERSİS No: ${p.mersis}`,
    p.kep && `KEP: ${p.kep}`,
    `Adres: ${p.address}`,
    ...extra,
  ]
    .filter(Boolean)
    .join(" — ");
}
