import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { ADDRESS_LINE, PHONE_DISPLAY } from "@/lib/site";

export const metadata: Metadata = {
  title: "Gizlilik Politikası",
  description: "Yıldırım Avize kişisel verilerin korunması (KVKK), çerez ve gizlilik politikası.",
  alternates: { canonical: "/gizlilik-politikasi" },
};

export default function Page() {
  return (
    <LegalPage
      path="/gizlilik-politikasi"
      title="Gizlilik Politikası"
      intro="Yıldırım Avize olarak kişisel verilerinizin güvenliğine önem veriyoruz. Bu sayfa gizlilik yaklaşımımızın kısa özetidir; ayrıntılar KVKK Aydınlatma Metni ve Çerez Politikası'ndadır."
      sections={[
        {
          title: "Veri Sorumlusu",
          body: [`Veri sorumlusu Yıldırım Avize Aydınlatma'dır. Adres: ${ADDRESS_LINE}. Telefon: ${PHONE_DISPLAY}. Unvan ve vergi bilgileri sayfa altındaki "Kurumsal & Yasal Bilgiler" bölümünde ve Aydınlatma Metni'nde yer alır.`],
        },
        {
          title: "Genel İlkeler",
          body: [
            "Kişisel verilerinizi yalnızca siparişinizi almak, teslim etmek, sizinle iletişim kurmak ve yasal yükümlülükleri yerine getirmek için gerektiği ölçüde işleriz. Verilerinizi üçüncü kişilere satmayız; yalnızca hizmetin gerektirdiği kargo, ödeme, e-posta ve altyapı hizmet sağlayıcılarıyla paylaşırız.",
            "İşlenen veriler, amaçlar, hukuki sebepler, aktarım yapılan alıcı grupları, yurt dışına aktarım ve KVKK madde 11 haklarınız hakkında ayrıntılı bilgi için Aydınlatma Metni'ni (/aydinlatma-metni) okuyabilirsiniz.",
          ],
        },
        {
          title: "Çerezler",
          body: ["Sitede kullanılan çerezler ve yerel depolama kayıtları Çerez Politikası'nda (/cerez-politikasi) açıklanmıştır."],
        },
        {
          title: "Başvuru",
          body: ["Kişisel verilerinize ilişkin taleplerinizi Aydınlatma Metni'nde belirtilen yazılı, KEP veya e-posta yollarıyla bize iletebilirsiniz."],
        },
      ]}
    />
  );
}
