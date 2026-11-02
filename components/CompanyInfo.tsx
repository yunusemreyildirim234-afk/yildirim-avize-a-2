import { ShieldCheck } from "lucide-react";
import { COMPANY_DEFAULTS, getCompanyInfo } from "@/lib/company";

/** Kurumsal & yasal bilgiler. `dark`: koyu zeminli footer, `light`: iletişim sayfası kartı. */
export default async function CompanyInfo({ variant }: { variant: "dark" | "light" }) {
  const c = await getCompanyInfo();
  const dark = variant === "dark";

  // Yalnızca boş değerler gizlenir; yöneticinin girdiği gerçek veri hiçbir kelime filtresine takılmaz.
  // Fabrika varsayılanındaki yer tutucular (COMPANY_DEFAULTS) ise açıkça tanınıp gizlenir.
  const hidden = (v: string, placeholder: string) => !v.trim() || v.trim() === placeholder;

  const rows: [string, string][] = [
    ["Unvan", c.companyTitle],
    ["Vergi Dairesi / No", `${c.taxOffice} / ${c.taxNumber}`],
    ...(hidden(c.mersisNo, COMPANY_DEFAULTS.mersisNo) ? [] : [["MERSİS No", c.mersisNo] as [string, string]]),
    ...(hidden(c.kepAddress, COMPANY_DEFAULTS.kepAddress) ? [] : [["KEP Adresi", c.kepAddress] as [string, string]]),
    ["Merkez Adresi", c.headquartersAddress],
  ];

  const etbisUrl = c.etbisUrl?.trim() || null;

  return (
    <section
      aria-label="Kurumsal ve yasal bilgiler"
      className={
        dark
          ? "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8 border-b border-zinc-800"
          : "bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 shadow-sm"
      }
    >
      <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-6 ${dark ? "" : ""}`}>
        <div className="min-w-0 flex-1">
          <h2 className={`text-xs font-bold uppercase tracking-wider mb-3 ${dark ? "text-neutral-200" : "text-neutral-900 font-serif text-base normal-case tracking-normal border-b border-neutral-100 pb-3"}`}>
            Kurumsal & Yasal Bilgiler
          </h2>
          <dl className={`grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-xs ${dark ? "text-neutral-400" : "text-neutral-600"}`}>
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className={`font-semibold ${dark ? "text-neutral-300" : "text-neutral-900"}`}>{k}</dt>
                <dd className="break-words mb-1 sm:mb-0">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {etbisUrl && (
          <a
            href={etbisUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label="ETBİS kaydını yeni sekmede doğrula"
            className={`shrink-0 inline-flex items-center gap-2 self-start rounded-xl border px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${
              dark
                ? "border-zinc-700 text-neutral-200 hover:border-amber-500 hover:text-amber-400"
                : "border-neutral-300 text-neutral-800 hover:border-amber-600 hover:text-amber-700"
            }`}
          >
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-amber-600" />
            ETBİS Kayıt Doğrulama
          </a>
        )}
      </div>
    </section>
  );
}
