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
            "ya_user (çerez, 30 gün): Giriş yaptığınızda hesabınızı tanımak için kullanılan oturum çerezidir. Giriş yapmadıkça oluşmaz.",
            "ya_oauth_state (çerez, 10 dakika): Google ile giriş sırasında oturum açma isteğinin doğruluğunu denetlemek için kullanılan güvenlik çerezidir.",
            "yildirim_cart ve yildirim_wishlist (yerel depolama): Sepetinizdeki ürünleri ve favorilerinizi tarayıcınızda saklar. Siz silene kadar kalır.",
            "ya-cerez-onayi (yerel depolama): Çerez çubuğundaki tercihinizi hatırlar.",
            "ya-theme (yerel depolama): Açık/koyu tema tercihinizi hatırlar.",
            "ya_sync_* ve ya-cart-cleared-* (yerel/oturum depolaması): Giriş yaptığınızda sepet ve favorilerinizin hesabınızla eşitlenmesi ve tamamlanan siparişten sonra sepetin bir kez temizlenmesi için teknik kayıtlardır.",
            "ya-cart-choices (oturum depolaması): Sepette seçtiğiniz teslimat ve ödeme yöntemini sayfalar arasında hatırlar.",
            "ya-pending-card-order (oturum depolaması): Kartlı ödeme ekranını kapatıp geri döndüğünüzde yarım kalan siparişinizi bulmak için sipariş numarasını tutar.",
            "ya_cart_merge_note (oturum depolaması): Giriş sonrası misafir sepetinizin hesabınıza eklendiğini bildiren notu bir kez göstermek için kullanılır.",
            "ya_recent_searches (yerel depolama): Son aramalarınızı arama kutusunda önermek için tarayıcınızda saklar.",
            "ya-avantaj-gizle (yerel depolama): Gizlediğiniz Avantajlar bölümünün bir gün boyunca (içerik değişmedikçe) yeniden gösterilmemesi için tercihi tutar.",
            "ya_sid (yerel depolama): Sitenin kendi kullanım kaydı için rastgele bir ziyaretçi kimliğidir; sepete ekleme, arama ve ödeme adımı gibi olayları aynı ziyaretçiye bağlar. Bu olay kayıtları 3 gün sonra silinir. Çerez çubuğundaki tercihinizden bağımsız çalışır.",
            "ya_email (yerel depolama): Eski sürümlerden kalmış olabilecek bir kayıttır; site artık e-posta adresinizi bu şekilde saklamaz ve eski değeri otomatik siler.",
            "ya-gtm-purchase-* (yerel depolama): Bir siparişin satın alma ölçümünün yalnızca bir kez gönderilmesi için sipariş başına işaret koyar; ölçüm ancak 'Kabul Et' dediyseniz yapılır.",
            "Yalnız yönetici: ya_admin (çerez, 8 saat) ve ya-admin-2fa-banner (yerel depolama) yalnızca site yönetim paneline giriş yapan yetkili kullanıcıda oluşur; ziyaretçilerde ve müşterilerde bulunmaz.",
            "Bu kayıtların tamamı sitenin çalışması ve istediğiniz hizmetin sunulması için gereklidir; yalnız ya-gtm-purchase-* tercihinize bağlı ölçümle ilgilidir.",
          ],
        },
        {
          title: "Analitik ve Pazarlama Çerezleri",
          body: [
            "Yalnız 'Kabul Et' dediğinizde, Google Tag Manager aracılığıyla Google Analytics ve reklam ölçümü hizmetleri yüklenir. Bu hizmetler ziyaret ettiğiniz sayfaları, sepete ekleme ve sipariş adımlarını ölçer; _ga, _ga_* ve _gcl_* gibi çerezler bırakır (süreleri Google tarafından belirlenir, genellikle 3 aydan 2 yıla kadardır). 'Reddet' derseniz bu araçlar yüklenmez. Tercihinizi sıfırlamak için tarayıcınızdan çerezleri ve site verilerini silebilirsiniz; çerez çubuğu yeniden görünür.",
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
