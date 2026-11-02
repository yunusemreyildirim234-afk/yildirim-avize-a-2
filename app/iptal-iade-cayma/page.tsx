import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { PHONE_DISPLAY } from "@/lib/site";
import { companyLine, getCompanyInfo, toPublicCompany } from "@/lib/company";
import { AYIPLI_MAL, CAYMA, MONTAJ_NOTU } from "@/lib/legal-texts";

export const metadata: Metadata = {
  title: "İptal, İade ve Cayma Hakkı",
  description: "Yıldırım Avize cayma hakkı, iptal ve iade süreci ile örnek cayma formu.",
  alternates: { canonical: "/iptal-iade-cayma" },
};

export default async function Page() {
  const p = toPublicCompany(await getCompanyInfo());
  return (
    <LegalPage
      path="/iptal-iade-cayma"
      title="İptal, İade ve Cayma Hakkı"
      intro="Bu sayfada, internetten verdiğiniz siparişlerde cayma hakkınızı nasıl kullanabileceğiniz ve sitemizdeki iptal/iade sürecinin nasıl işlediği anlatılır. Ayrıntılar Mesafeli Satış Sözleşmesi'nde yer alır."
      sections={[
        {
          title: "Cayma Hakkı",
          body: [CAYMA.hak, CAYMA.istisna, MONTAJ_NOTU],
        },
        {
          title: "Cayma Bildirimini Nasıl Yaparım?",
          body: [
            CAYMA.bildirim,
            `Bildirim adresi: ${companyLine(p, [`Tel: ${PHONE_DISPLAY}`])}. Cayma bildirimi için telefon görüşmesi yeterli bir yöntem değildir; lütfen yukarıdaki yazılı yollardan birini kullanın.`,
          ],
        },
        {
          title: "Sitemizdeki İptal ve İade Süreci",
          body: [
            "1) Hesabınıza giriş yaparak \"Siparişlerim\" bölümünden ilgili siparişi açın. Henüz teslim edilmemiş siparişlerde \"İptal Talebi Gönder\", teslim edilmiş siparişlerde \"İade Talebi Gönder\" düğmesi görünür; isteğe bağlı olarak nedeninizi yazabilirsiniz.",
            "2) Talebiniz mağaza yönetimine iletilir ve incelenir. Sonuç, kayıtlı e-posta adresinize bildirilir ve Siparişlerim ekranında da görünür. Misafir (üyeliksiz) siparişlerde ya da giriş yapamadığınız durumlarda yukarıdaki yazılı yollarla bildirim yapabilirsiniz.",
            "3) İade onaylandığında ürünün size bildirilen adrese ve taşıyıcıya gönderilmesi için gerekli bilgiler e-posta veya iletişim kanallarımız aracılığıyla ayrıca iletilir.",
            CAYMA.alici,
            CAYMA.satici,
            "Ödemenin iadesi, ödeme yöntemine göre (kredi/banka kartı veya Havale/EFT) mağaza tarafından yapılır.",
          ],
        },
        {
          title: "Ayıplı veya Hasarlı Ürün",
          body: [
            AYIPLI_MAL,
            "Kargo açılışında kristal taşta çatlak veya eksik parça fark ederseniz, WhatsApp destek hattımıza fotoğraf göndermeniz yeterlidir.",
          ],
        },
        {
          title: "Örnek Cayma Formu",
          body: [
            "Cayma hakkınızı kullanmak istediğinizde aşağıdaki formu doldurup yukarıda belirtilen yazılı yollardan birine iletebilirsiniz. Bu formun kullanılması zorunlu değildir; aynı bilgileri içeren her türlü yazılı bildirim geçerlidir.",
            `Kime: ${p.title} — ${p.address}${p.kep ? ` — KEP: ${p.kep}` : ""}`,
            "Aşağıdaki malın satışına ilişkin sözleşmeden cayma hakkımı kullandığımı beyan ederim.",
            "Sipariş numarası / sipariş tarihi: ...............................................",
            "Cayma konusu mal(lar): ...............................................",
            "Malı teslim aldığım tarih: ...............................................",
            "Tüketicinin adı soyadı: ...............................................",
            "Tüketicinin adresi: ...............................................",
            "Ödeme iadesi için IBAN (Havale/EFT ile ödeyenler): ...............................................",
            "Tarih ve imza (kâğıt ortamında bildirimde): ...............................................",
          ],
        },
      ]}
    />
  );
}
