import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { ADDRESS_LINE, PHONE_DISPLAY } from "@/lib/site";

export const metadata: Metadata = {
  title: "Gizlilik Politikası & KVKK Aydınlatma Metni",
  description: "Yıldırım Avize kişisel verilerin korunması (KVKK), çerez ve gizlilik politikası.",
  alternates: { canonical: "/gizlilik-politikasi" },
};

export default function Page() {
  return (
    <LegalPage
      path="/gizlilik-politikasi"
      title="Gizlilik Politikası"
      intro="Yıldırım Avize olarak kişisel verilerinizin güvenliğine önem veriyoruz. Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında hazırlanmış aydınlatma metnidir."
      sections={[
        {
          title: "Veri Sorumlusu",
          body: [`Veri sorumlusu Yıldırım Avize Aydınlatma'dır. Adres: ${ADDRESS_LINE}. Telefon: ${PHONE_DISPLAY}.`],
        },
        {
          title: "İşlenen Veriler ve Amaçlar",
          body: [
            "Ad-soyad, e-posta, telefon, teslimat adresi ve sipariş bilgileriniz; siparişinizin alınması, ödemenin ve teslimatın gerçekleştirilmesi, müşteri iletişimi ve yasal yükümlülüklerin yerine getirilmesi amacıyla işlenir.",
          ],
        },
        {
          title: "Verilerin Aktarılması",
          body: [
            "Verileriniz yalnızca hizmetin gerektirdiği ölçüde kargo/lojistik firmaları (Kargonomi ve anlaşmalı taşıyıcılar), ödeme kuruluşları ve e-posta hizmet sağlayıcılarıyla paylaşılır. Verileriniz üçüncü kişilere satılmaz.",
          ],
        },
        {
          title: "Çerezler",
          body: [
            "Sitemiz sepet ve favori tercihlerinizi tarayıcınızda saklamak için zorunlu çerez/yerel depolama kullanır. Tercihinizi ilk ziyarette çerez barından belirtebilirsiniz.",
          ],
        },
        {
          title: "Haklarınız",
          body: [
            "KVKK madde 11 uyarınca verilerinize erişme, düzeltme, silme, işlenmesine itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz. Taleplerinizi yukarıdaki iletişim bilgilerinden bize iletebilirsiniz.",
          ],
        },
      ]}
    />
  );
}
