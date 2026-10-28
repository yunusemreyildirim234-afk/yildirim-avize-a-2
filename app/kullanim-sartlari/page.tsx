import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Kullanım Şartları",
  description: "Yıldırım Avize web sitesi kullanım şartları ve genel hükümler.",
  alternates: { canonical: "/kullanim-sartlari" },
};

export default function Page() {
  return (
    <LegalPage
      path="/kullanim-sartlari"
      title="Kullanım Şartları"
      intro="Bu siteyi kullanarak aşağıdaki şartları kabul etmiş sayılırsınız."
      sections={[
        {
          title: "Genel Hükümler",
          body: [
            "Sitedeki ürün görselleri, açıklamalar ve fiyatlar bilgilendirme amaçlıdır. Yıldırım Avize fiyat, stok ve içerik üzerinde önceden haber vermeden değişiklik yapma hakkını saklı tutar.",
          ],
        },
        {
          title: "Üyelik ve Sipariş",
          body: [
            "Sipariş verirken sunduğunuz bilgilerin doğru ve güncel olması sizin sorumluluğunuzdadır. Hatalı fiyat veya stok bilgisi nedeniyle iptal edilen siparişlerde ödenen tutar iade edilir.",
          ],
        },
        {
          title: "Fikri Mülkiyet",
          body: [
            "Sitedeki marka, logo, görsel ve metinler Yıldırım Avize'ye aittir; izinsiz kopyalanamaz, çoğaltılamaz veya ticari amaçla kullanılamaz.",
          ],
        },
        {
          title: "Sorumluluk Sınırı",
          body: [
            "Site kesintisiz veya hatasız çalışma garantisi vermez. Üçüncü taraf bağlantılardaki içeriklerden Yıldırım Avize sorumlu değildir.",
          ],
        },
        {
          title: "Uygulanacak Hukuk",
          body: ["Uyuşmazlıklarda Türkiye Cumhuriyeti hukuku uygulanır; İstanbul mahkemeleri ve icra daireleri yetkilidir."],
        },
      ]}
    />
  );
}
