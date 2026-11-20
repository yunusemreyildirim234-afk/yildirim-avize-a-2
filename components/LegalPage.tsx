import Breadcrumbs from "@/components/Breadcrumbs";
import { LEGAL_UPDATED } from "@/lib/legal-texts";

export interface LegalSection {
  title: string;
  body: string[];
}

export default function LegalPage({
  title,
  intro,
  path,
  sections,
  updated = LEGAL_UPDATED,
}: {
  title: string;
  intro: string;
  path: string;
  sections: LegalSection[];
  updated?: string;
}) {
  return (
    <main className="min-h-screen bg-canvas py-12 px-4 sm:px-6 lg:px-8">
      <article className="max-w-3xl mx-auto bg-raised rounded-3xl border border-line p-6 sm:p-12 shadow-sm">
        <Breadcrumbs
          className="text-ink-muted mb-6"
          items={[{ name: "Ana Sayfa", href: "/" }, { name: title, href: path }]}
        />
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-ink">{title}</h1>
        <p className="text-sm text-ink-muted leading-relaxed mt-3">{intro}</p>
        <div className="mt-8 space-y-8">
          {sections.map((s, i) => (
            <section key={s.title}>
              <h2 className="text-base font-bold text-ink">
                {i + 1}. {s.title}
              </h2>
              {s.body.map((p) => (
                <p key={p} className="text-sm text-ink-muted leading-relaxed mt-2">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
        <p className="text-[11px] text-ink-subtle mt-10 pt-4 border-t border-line">
          Son güncelleme: {updated}
        </p>
      </article>
    </main>
  );
}
