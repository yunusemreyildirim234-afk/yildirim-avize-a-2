import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { PHONE_DISPLAY } from "@/lib/site";
import { companyLine, getCompanyInfo, toPublicCompany } from "@/lib/company";
import { AYIPLI_MAL, CAYMA, MONTAJ_NOTU, ODEME, TESLIMAT_SURESI } from "@/lib/legal-texts";

export const metadata: Metadata = {
  title: "Mesafeli Satış Sözleşmesi",
  description: "Yıldırım Avize mesafeli satış sözleşmesi, teslimat, cayma ve iade koşulları.",
  alternates: { canonical: "/mesafeli-satis-sozlesmesi" },
};

export default async function Page() {
  const c = await getCompanyInfo();
  const sellerLine = companyLine(toPublicCompany(c), [`Tel: ${PHONE_DISPLAY}`]);
  return (
    <LegalPage
      path="/mesafeli-satis-sozlesmesi"
      title="Mesafeli Satış Sözleşmesi"
      intro="Bu sözleşme, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca düzenlenmiştir."
      sections={[
        {
          title: "Taraflar",
          body: [
            `SATICI: ${sellerLine}.`,
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
          title: "Ödeme",
          body: [ODEME],
        },
        {
          title: "Teslimat",
          body: [
            "Ürünler ALICI'nın seçimine göre Beyoğlu Şişhane mağazasından teslim alınır veya özel üst düzey korumalı koliyle anlaşmalı kargo firması aracılığıyla adrese gönderilir. Kargo teslimatında paketin kurye huzurunda kontrol edilmesi ve hasar halinde tutanak tutulması önerilir. Teslimata kadar ürün SATICI'nın sorumluluğundadır.",
            TESLIMAT_SURESI,
            MONTAJ_NOTU,
          ],
        },
        {
          title: "Cayma Hakkı",
          body: [CAYMA.hak, CAYMA.bildirim, CAYMA.istisna],
        },
        {
          title: "İade ve Ödemelerin İadesi",
          body: [CAYMA.alici, CAYMA.satici],
        },
        {
          title: "Ayıplı Mal",
          body: [AYIPLI_MAL],
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
