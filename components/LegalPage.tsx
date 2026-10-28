import Breadcrumbs from "@/components/Breadcrumbs";

export interface LegalSection {
  title: string;
  body: string[];
}

export default function LegalPage({
  title,
  intro,
  path,
  sections,
}: {
  title: string;
  intro: string;
  path: string;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-screen bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
      <article className="max-w-3xl mx-auto bg-white rounded-3xl border border-neutral-200 p-6 sm:p-12 shadow-sm">
        <Breadcrumbs
          className="text-neutral-500 mb-6"
          items={[{ name: "Ana Sayfa", href: "/" }, { name: title, href: path }]}
        />
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900">{title}</h1>
        <p className="text-sm text-neutral-600 leading-relaxed mt-3">{intro}</p>
        <div className="mt-8 space-y-8">
          {sections.map((s, i) => (
            <section key={s.title}>
              <h2 className="text-base font-bold text-neutral-900">
                {i + 1}. {s.title}
              </h2>
              {s.body.map((p) => (
                <p key={p} className="text-sm text-neutral-600 leading-relaxed mt-2">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
        <p className="text-[11px] text-neutral-400 mt-10 pt-4 border-t border-neutral-100">
          Son güncelleme: Ekim 2026
        </p>
      </article>
    </main>
  );
}
