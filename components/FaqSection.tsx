import JsonLd from "@/components/JsonLd";

const FAQS = [
  {
    q: "Avizeler kargoda kırılmadan nasıl ulaşıyor?",
    a: "Her avize, içi özel dolgu malzemesiyle desteklenmiş üst düzey korumalı koliyle paketlenir ve Kargonomi altyapısıyla sigortalı olarak gönderilir. Paketleme ustalarımız tarafından Beyoğlu atölyemizde yapılır.",
  },
  {
    q: "Kırılma veya hasar durumunda garanti var mı?",
    a: "Taşıma sırasında oluşan kırılma ve hasarlar sigorta kapsamındadır. Teslimatta paketi kurye önünde kontrol edip tutanak tutturmanız yeterlidir; ürün ücretsiz değiştirilir veya iade edilir.",
  },
  {
    q: "Avize montajını siz yapıyor musunuz?",
    a: "İstanbul içi siparişlerde montaj için usta yönlendirmesi yapabiliyoruz. Diğer şehirler için adım adım montaj kılavuzu ve WhatsApp üzerinden canlı teknik destek sağlıyoruz.",
  },
  {
    q: "Tavan yüksekliğime uygun avizeyi nasıl seçerim?",
    a: "Tavan yüksekliğinizi ve salon fotoğrafınızı WhatsApp hattımıza (0545 812 69 90) gönderin; boyut, duy sayısı ve zincir uzunluğu konusunda ücretsiz danışmanlık verelim.",
  },
  {
    q: "Siparişimi mağazadan teslim alabilir miyim?",
    a: "Evet. Sepette \"Beyoğlu Mağaza Teslim\" seçeneğini seçerek siparişinizi Şişhane atölyemizden kargo ücreti ödemeden, ışık kontrolünü yaptırarak teslim alabilirsiniz.",
  },
];

export default function FaqSection() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section aria-labelledby="sss-baslik" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <JsonLd data={schema} />
      <div className="text-center mb-8 space-y-2">
        <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold">Sık Sorulan Sorular</span>
        <h2 id="sss-baslik" className="text-2xl sm:text-3xl font-serif font-bold text-white">
          Kargolama, Garanti & Montaj
        </h2>
      </div>
      <div className="space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="group bg-white/5 border border-zinc-700 rounded-2xl px-5 py-4">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-sm font-semibold text-zinc-100">
              {f.q}
              <span aria-hidden="true" className="text-amber-400 transition-transform group-open:rotate-45 text-lg leading-none">
                +
              </span>
            </summary>
            <p className="mt-3 text-xs text-zinc-300 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
