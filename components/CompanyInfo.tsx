import { getCompanyInfo } from "@/lib/company";

/** Kurumsal & yasal bilgiler. `dark`: koyu zeminli footer, `light`: iletişim sayfası kartı. */
export default async function CompanyInfo({ variant }: { variant: "dark" | "light" }) {
  const c = await getCompanyInfo();
  const dark = variant === "dark";

  // Yönetici gerçek veriyi girene kadar örnek/boş MERSİS ve KEP satırları müşteriye gösterilmez
  const isPlaceholder = (v: string) => !v.trim() || /örnek|ornek/i.test(v);

  const rows: [string, string][] = [
    ["Unvan", c.companyTitle],
    ["Vergi Dairesi / No", `${c.taxOffice} / ${c.taxNumber}`],
    ...(isPlaceholder(c.mersisNo) ? [] : [["MERSİS No", c.mersisNo] as [string, string]]),
    ...(isPlaceholder(c.kepAddress) ? [] : [["KEP Adresi", c.kepAddress] as [string, string]]),
    ["Merkez Adresi", c.headquartersAddress],
  ];

  const qr = c.etbisQrImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={c.etbisQrImage} alt="ETBİS karekodu" loading="lazy" className="h-24 w-24 rounded-lg bg-white object-contain p-1" />
  ) : null;

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

        {(qr || c.etbisUrl) && (
          <div className="shrink-0 flex flex-col items-start sm:items-center gap-2">
            <span className={`text-[11px] font-semibold ${dark ? "text-neutral-300" : "text-neutral-900"}`}>ETBİS</span>
            {qr && c.etbisUrl ? (
              <a href={c.etbisUrl} target="_blank" rel="noopener noreferrer nofollow" aria-label="ETBİS kaydını görüntüle">
                {qr}
              </a>
            ) : (
              qr
            )}
            {c.etbisUrl && (
              <a
                href={c.etbisUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={`text-[11px] underline underline-offset-2 ${dark ? "text-amber-400 hover:text-amber-300" : "text-amber-700 hover:text-amber-800"}`}
              >
                Kayıt doğrulama
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
