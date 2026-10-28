import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { ADDRESS_LINE, PHONE_DISPLAY } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mesafeli Satış Sözleşmesi",
  description: "Yıldırım Avize mesafeli satış sözleşmesi, teslimat, cayma ve iade koşulları.",
  alternates: { canonical: "/mesafeli-satis-sozlesmesi" },
};

export default function Page() {
  return (
    <LegalPage
      path="/mesafeli-satis-sozlesmesi"
      title="Mesafeli Satış Sözleşmesi"
      intro="Bu sözleşme, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca düzenlenmiştir."
      sections={[
        {
          title: "Taraflar",
          body: [
            `SATICI: Yıldırım Avize Aydınlatma — ${ADDRESS_LINE} — Tel: ${PHONE_DISPLAY}.`,
            "ALICI: Sitede sipariş veren ve sipariş formunda bilgilerini bildiren kişidir.",
          ],
        },
        {
          title: "Sözleşmenin Konusu",
          body: [
            "Sözleşmenin konusu, ALICI'nın internet sitesi üzerinden sipariş ettiği ürünlerin satışı, teslimi ve tarafların hak ve yükümlülükleridir. Ürünün cinsi, adedi, vergiler dahil satış fiyatı ve kargo bedeli sipariş özetinde yer alır.",
          ],
        },
        {
          title: "Teslimat",
          body: [
            "Ürünler ALICI'nın seçimine göre Beyoğlu Şişhane mağazasından teslim alınır veya özel üst düzey korumalı koliyle anlaşmalı kargo firması aracılığıyla adrese gönderilir. Kargo teslimatında paketin kurye huzurunda kontrol edilmesi ve hasar halinde tutanak tutulması önerilir.",
          ],
        },
        {
          title: "Cayma Hakkı",
          body: [
            "ALICI, ürünü teslim aldığı tarihten itibaren 14 gün içinde herhangi bir gerekçe göstermeksizin cayma hakkını kullanabilir. Cayma bildirimi yukarıdaki iletişim bilgilerine yapılır. Kullanılmış, montajı yapılmış veya ALICI'nın talebiyle özel üretilmiş ürünlerde cayma hakkı kullanılamayabilir.",
          ],
        },
        {
          title: "İade ve Ödeme",
          body: [
            "Cayma bildiriminden sonra ürün 10 gün içinde orijinal ambalajında iade edilir; bedel, ürünün SATICI'ya ulaşmasından itibaren 14 gün içinde ALICI'ya iade edilir.",
          ],
        },
        {
          title: "Uyuşmazlıkların Çözümü",
          body: [
            "Uyuşmazlıklarda Ticaret Bakanlığı'nca ilan edilen değere kadar ALICI'nın yerleşim yerindeki Tüketici Hakem Heyetleri, bu değerin üzerinde Tüketici Mahkemeleri yetkilidir.",
          ],
        },
      ]}
    />
  );
}
