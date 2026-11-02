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
  etbisQrImage: null as string | null,
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
      etbisQrImage: row.etbisQrImage,
    };
  },
  ["site-config"],
  { tags: [COMPANY_TAG], revalidate: 300 }
);
