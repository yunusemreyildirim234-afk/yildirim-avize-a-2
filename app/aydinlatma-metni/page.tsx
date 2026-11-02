import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { LEGAL_CONTACT_EMAIL, PHONE_DISPLAY } from "@/lib/site";
import { companyLine, getCompanyInfo, legalChannels, toPublicCompany } from "@/lib/company";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni",
  description: "Yıldırım Avize müşteri aydınlatma metni: işlenen kişisel veriler, amaçlar, aktarım ve KVKK m.11 hakları.",
  alternates: { canonical: "/aydinlatma-metni" },
};

export default async function Page() {
  const p = toPublicCompany(await getCompanyInfo());
  return (
    <LegalPage
      path="/aydinlatma-metni"
      title="Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni"
      intro="Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun (KVKK) 10. maddesi ve Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ kapsamında, müşterilerimizi ve site ziyaretçilerimizi bilgilendirmek amacıyla hazırlanmıştır. Bir onay metni değildir; bilgilendirme amaçlıdır."
      sections={[
        {
          title: "Veri Sorumlusu",
          body: [
            `${companyLine(p, [`Tel: ${PHONE_DISPLAY}`, `E-posta: ${LEGAL_CONTACT_EMAIL}`])}.`,
            'Bu metinde "Yıldırım Avize" veya "biz" ifadesiyle yukarıdaki veri sorumlusu kastedilmektedir.',
          ],
        },
        {
          title: "İşlenen Kişisel Veri Kategorileri",
          body: [
            "Kimlik ve iletişim bilgileri: ad-soyad, e-posta adresi, telefon numarası.",
            "Teslimat ve fatura bilgileri: teslimat adresi, il/ilçe; kurumsal faturada unvan, vergi dairesi ve vergi kimlik numarası (bireysel faturada girilmişse T.C. kimlik numarası).",
            "Müşteri işlemi bilgileri: sipariş içeriği, tutarı, ödeme yöntemi, kargo ve takip bilgileri, iptal/iade talepleri, sipariş notları, uygulanan kupon.",
            "Ödeme bilgileri: kartlı ödemelerde kart bilgileriniz doğrudan ödeme kuruluşu PayTR'nin güvenli ödeme sayfasında girilir ve tarafımızca saklanmaz. Havale/EFT'de gönderici adı ve yüklenen dekont tarafımızca işlenir.",
            "İçerik bilgileri: iletişim formu mesajları, ürün soruları, ürün yorumları ve yüklediğiniz fotoğraflar, dekont dosyaları.",
            "Hesap ve işlem güvenliği bilgileri: Google ile giriş yapıldığında Google'dan alınan ad, e-posta ve profil fotoğrafı; doğrulama kodları; oturum çerezi; kötüye kullanımı sınırlamak için istekler sırasında işlenen IP adresi.",
          ],
        },
        {
          title: "Kişisel Verilerin İşlenme Amaçları",
          body: [
            "Siparişinizin alınması, ödemenin tahsili, ürünün hazırlanması ve teslimi (mağazadan teslim veya kargo).",
            "Sipariş, kargo, iptal/iade ve cayma süreçlerinin yürütülmesi ve bu konularda sizinle e-posta yoluyla iletişim kurulması.",
            "Fatura düzenlenmesi; muhasebe, vergi ve ticaret mevzuatından doğan yükümlülüklerin yerine getirilmesi.",
            "Müşteri taleplerinin, sorularının ve şikâyetlerinin yanıtlanması; ürün yorumlarının yayın öncesi incelenmesi.",
            "Hesap ve site güvenliğinin sağlanması, dolandırıcılık ve kötüye kullanımın önlenmesi.",
            "Terk edilen ödeme denemeleri ve havale dekont hatırlatmaları gibi sipariş sürecine bağlı bildirimlerin gönderilmesi.",
          ],
        },
        {
          title: "Hukuki Sebepler",
          body: [
            "Sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (KVKK m.5/2-c): sipariş, ödeme, teslimat, iptal/iade ve cayma süreçleri.",
            "Hukuki yükümlülüğün yerine getirilmesi (m.5/2-ç): fatura, vergi, muhasebe ve tüketici mevzuatından doğan saklama ve bildirim yükümlülükleri.",
            "Kanunlarda açıkça öngörülmesi (m.5/2-a): mevzuatın veri işlemeyi açıkça gerektirdiği haller.",
            "Bir hakkın tesisi, kullanılması veya korunması için zorunlu olması (m.5/2-e): olası uyuşmazlıklarda delil olarak saklama.",
            "Veri sorumlusunun meşru menfaati (m.5/2-f), temel hak ve özgürlüklerinize zarar vermemek kaydıyla: site güvenliği, kötüye kullanımın önlenmesi, hizmet kalitesinin sağlanması.",
          ],
        },
        {
          title: "Kişisel Verilerin Toplanma Yöntemi",
          body: [
            "Verileriniz; sitedeki sipariş, üyelik/giriş, iletişim, ürün sorusu, yorum ve dekont yükleme formları aracılığıyla, e-posta ve WhatsApp üzerinden yazışmalarınızla, Google ile giriş yapmanız halinde Google hesabınızdan ve site kullanımınız sırasında tarayıcınızın otomatik ilettiği teknik bilgilerle, elektronik ortamda toplanır.",
          ],
        },
        {
          title: "Kişisel Verilerin Aktarıldığı Alıcı Grupları ve Amaçları",
          body: [
            "Kargo ve lojistik: teslimat için ad-soyad, telefon, e-posta ve adres bilgileriniz Kargonomi platformuna ve gönderiyi taşıyan kargo firmasına (Aras Kargo) aktarılır.",
            "Ödeme kuruluşu: kartlı ödemelerde ödemenin gerçekleştirilmesi için gerekli bilgiler PayTR'ye aktarılır.",
            "E-posta hizmet sağlayıcısı: sipariş, kargo ve talep bildirimlerinin iletilmesi için e-posta adresiniz ve bildirim içeriği Resend hizmeti aracılığıyla gönderilir.",
            "Barındırma ve altyapı: sitenin ve veritabanının işletilmesi için barındırma (Vercel) ve veritabanı (Neon) hizmet sağlayıcıları verilerinizi bizim adımıza işler. Oturum açma amacıyla Google'ın kimlik doğrulama hizmeti kullanılır.",
            "Yetkili kamu kurum ve kuruluşları: mevzuatın gerektirdiği hallerde ve yetkili makamların talebi üzerine, talebin kapsamıyla sınırlı olarak aktarım yapılır.",
            "Verileriniz üçüncü kişilere satılmaz veya pazarlama amacıyla devredilmez.",
          ],
        },
        {
          title: "Yurt Dışına Aktarım",
          body: [
            "Barındırma, veritabanı, e-posta ve kimlik doğrulama hizmeti sağlayıcılarımızın sunucuları ve ekipleri yurt dışında bulunabilir. Bu nedenle kişisel verileriniz, hizmetin sunulması kapsamında yurt dışına aktarılabilir veya yurt dışından erişilebilir. Aktarım, KVKK'nın 9. maddesi ve ilgili mevzuatta öngörülen şartlara uygun olarak yapılır.",
          ],
        },
        {
          title: "Saklama Süresi",
          body: [
            "Kişisel verileriniz, işlendikleri amaç için gerekli olan süre boyunca ve ilgili mevzuatta (Türk Ticaret Kanunu, Vergi Usul Kanunu, Tüketicinin Korunması Hakkında Kanun vb.) öngörülen yasal saklama süreleri boyunca saklanır; sürenin sonunda silinir, yok edilir veya anonim hale getirilir.",
          ],
        },
        {
          title: "KVKK Madde 11 Kapsamındaki Haklarınız",
          body: [
            "Veri sorumlusuna başvurarak şu haklarınızı kullanabilirsiniz: kişisel verilerinizin işlenip işlenmediğini öğrenme; işlenmişse buna ilişkin bilgi talep etme; işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme; yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme; eksik veya yanlış işlenmişse düzeltilmesini isteme; KVKK m.7 çerçevesinde silinmesini veya yok edilmesini isteme ve bu işlemlerin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme; işlenen verilerin münhasıran otomatik sistemlerle analiz edilmesi sonucunda aleyhinize bir sonuç çıkmasına itiraz etme; kanuna aykırı işleme nedeniyle zarara uğramanız halinde zararın giderilmesini talep etme.",
          ],
        },
        {
          title: "Başvuru Yolları",
          body: [
            `Taleplerinizi; kimliğinizi tespit edici bilgileri ve talebinizin konusunu içeren yazılı bir dilekçeyle yukarıdaki adrese elden veya posta yoluyla, ${p.kep ? `KEP adresimiz (${p.kep}) üzerinden` : "KEP üzerinden"}, ya da ${LEGAL_CONTACT_EMAIL} adresine e-posta ile iletebilirsiniz (iletişim kanalları: ${legalChannels(p)}). Başvurunuz, niteliğine göre en geç 30 gün içinde sonuçlandırılır. Başvurunun reddedilmesi, cevabın yetersiz bulunması veya süresinde cevap verilmemesi halinde Kişisel Verileri Koruma Kurulu'na şikâyet hakkınız saklıdır.`,
          ],
        },
      ]}
    />
  );
}
