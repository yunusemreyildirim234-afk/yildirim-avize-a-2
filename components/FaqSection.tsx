import Link from "next/link";
import JsonLd from "@/components/JsonLd";

const FAQS: { q: string; a: string; link?: { href: string; label: string } }[] = [
  {
    q: "Ampuller avizeye dahil midir? Hangi ampulü almalıyım?",
    a: "Ampuller, ürün sayfasında 'LED ampul hediye' yazan ürünlerde hediye olarak gönderilir; diğer ürünlerde ürüne dahil değildir. Ürün detayında belirtilen standart duy tipine (E14, E27 veya G9) uygun tüm tasarruflu LED ampulleri güvenle tercih edebilirsiniz.",
  },
  {
    q: "Ödeme seçenekleri ve taksit imkanı var mı?",
    a: "Tüm siparişlerinizde PayTR altyapısıyla 3D Secure güvencesinde tüm kredi kartlarına peşin veya taksitli ödeme yapabilirsiniz. Ayrıca Kuveyt Türk hesabımıza Havale/EFT ile ödeme seçeneğimiz de mevcuttur.",
  },
  {
    q: "Kargo süreci ne kadar sürer ve nasıl takip edebilirim?",
    a: "Siparişiniz onaylandıktan sonra ürününüz Şişhane atölyemizde özenle kontrol edilip paketlenir ve Aras Kargo güvencesiyle 1-3 iş günü içinde kargoya verilir. Kargo takip kodunuz e-posta ile iletilir; ayrıca sitemizdeki \"Kargo Takip\" sayfasından paketinizi canlı izleyebilirsiniz.",
  },
  {
    q: "Eksik veya hasarlı taş/parça çıkarsa ne yapmalıyım?",
    a: "Kargo açılışında herhangi bir kristal taşta çatlak veya eksik parça fark ederseniz WhatsApp destek hattımıza fotoğrafını iletmeniz yeterlidir. Kusurlu veya eksik parçalar hiçbir kargo ve ürün ücreti talep edilmeksizin 1 iş günü içinde adresinize ücretsiz olarak kargolanır.",
  },
  {
    q: "Kurumsal fatura alabilir miyim?",
    a: "Evet. Ödeme adımında \"Kurumsal Fatura\" seçeneğini işaretleyip şirket unvanı, vergi dairesi ve VKN bilgilerinizi girerek faturanızın şirketiniz adına düzenlenmesini sağlayabilirsiniz.",
  },
  {
    q: "Beğenmezsem iade veya değişim yapabilir miyim?",
    a: "Standart ürünlerimizi teslim aldığınız tarihten itibaren 14 gün içinde cayma hakkınızı kullanabilir veya başka bir modelle değiştirebilirsiniz; ürünü mümkünse orijinal ambalajıyla gönderin. Değişim için WhatsApp'tan bize yazın. (Özel ölçü veya isteğe bağlı modifiye edilen ürünler cayma hakkı kapsamı dışındadır).",
    link: { href: "/iptal-iade-cayma", label: "İptal, İade ve Cayma sayfası" },
  },
  {
    q: "Kristal avizelerin temizliği ve bakımı nasıl yapılmalıdır?",
    a: "Avizenizin kristal parlaklığını ve metal aksamını uzun yıllar koruması için kimyasal deterjanlar kesinlikle kullanılmamalıdır bunun yerine hafif nemli mikrofiber bez kullanılması uygundur. Temizlik öncesinde elektrik bağlantısının kapalı olduğundan emin olunmalıdır.",
  },
  {
    q: "Tavana montaj hizmeti veriyor musunuz?",
    a: "Evin tavanına montaj hizmeti verilmemektedir. İhtiyaç duymanız halinde elektrikçiniz için WhatsApp destek hattımız üzerinden uzaktan teknik bilgilendirme desteği sağlamaktayız.",
  },
  {
    q: "Siparişimi mağazadan teslim alabilir miyim?",
    a: "Evet. Sepette \"Mağazadan Teslim\" seçeneğini seçerek %3 indirim kampanyamızı kullanabilir ve siparişinizi Şişhane merkezimizden teslim alabilirsiniz.",
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
        <h2 id="sss-baslik" className="scroll-mt-32 text-2xl sm:text-3xl font-serif font-bold text-white">
          Kargolama & Montaj
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
            {f.link && (
              <Link href={f.link.href} className="mt-2 inline-block text-xs text-amber-400 underline underline-offset-2 hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">
                {f.link.label}
              </Link>
            )}
          </details>
        ))}
      </div>
    </section>
  );
}
