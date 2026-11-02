import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Çerez Politikası",
  description: "Yıldırım Avize sitesinde kullanılan çerezler ve tarayıcı yerel depolama türleri.",
  alternates: { canonical: "/cerez-politikasi" },
};

export default function Page() {
  return (
    <LegalPage
      path="/cerez-politikasi"
      title="Çerez Politikası"
      intro="Bu sayfa, sitemizin tarayıcınızda hangi çerezleri ve yerel depolama kayıtlarını kullandığını açıklar. Kişisel verilerinizin işlenmesi için Aydınlatma Metni'ne bakabilirsiniz."
      sections={[
        {
          title: "Kullandığımız Çerezler ve Yerel Depolama",
          body: [
            "ya_user (çerez, oturum): Giriş yaptığınızda hesabınızı tanımak için kullanılan oturum çerezidir. Giriş yapmadıkça oluşmaz.",
            "ya_oauth_state (çerez, 10 dakika): Google ile giriş sırasında oturum açma isteğinin doğruluğunu denetlemek için kullanılan güvenlik çerezidir.",
            "yildirim_cart ve yildirim_wishlist (yerel depolama): Sepetinizdeki ürünleri ve favorilerinizi tarayıcınızda saklar. Siz silene kadar kalır.",
            "ya-cerez-onayi (yerel depolama): Çerez çubuğundaki tercihinizi hatırlar.",
            "ya-theme (yerel depolama): Açık/koyu tema tercihinizi hatırlar.",
            "ya_sync_* ve ya-cart-cleared-* (yerel/oturum depolaması): Giriş yaptığınızda sepet ve favorilerinizin hesabınızla eşitlenmesi ve tamamlanan siparişten sonra sepetin bir kez temizlenmesi için teknik kayıtlardır.",
            "Bu kayıtların tamamı sitenin çalışması ve istediğiniz hizmetin sunulması için gereklidir.",
          ],
        },
        {
          title: "Analitik ve Pazarlama Çerezleri",
          body: [
            "Sitemizde ziyaretçi davranışını izleyen analitik veya reklam/pazarlama amaçlı çerez ya da betik kullanılmamaktadır. Bu türde bir araç kullanılmaya başlanırsa bu sayfa güncellenir ve gerekli olduğu durumlarda önceden tercihiniz alınır.",
          ],
        },
        {
          title: "Üçüncü Taraf Hizmetler",
          body: [
            "Kartlı ödeme adımında PayTR'nin güvenli ödeme sayfası, mağaza konumunu göstermek için sayfa altındaki Google Haritalar bileşeni ve Google ile giriş seçeneği kullanılır. Bu hizmetler kendi çerezlerini kendi gizlilik politikalarına göre yerleştirebilir; bu çerezler üzerinde tarafımızın kontrolü yoktur.",
          ],
        },
        {
          title: "Çerezleri Yönetme",
          body: [
            "Tarayıcınızın ayarlarından çerezleri ve site verilerini silebilir veya engelleyebilirsiniz. Zorunlu kayıtları engellemeniz halinde giriş yapma, sepeti saklama ve sipariş verme gibi özellikler çalışmayabilir. Çerez çubuğundaki tercihinizi yeniden yapmak için tarayıcınızdaki site verilerini temizlemeniz yeterlidir.",
          ],
        },
      ]}
    />
  );
}
