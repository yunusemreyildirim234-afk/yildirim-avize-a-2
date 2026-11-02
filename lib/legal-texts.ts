// Cayma/iade metinleri tek yerde tutulur: sepetteki ön bilgilendirme formu, mesafeli satış sözleşmesi
// ve /iptal-iade-cayma sayfası aynı cümleleri kullanır (metinler birbiriyle çelişmesin).

export const LEGAL_UPDATED = "2 Kasım 2026";

export const CAYMA = {
  hak: "ALICI, malı teslim aldığı tarihten itibaren 14 gün içinde herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayma hakkına sahiptir.",
  bildirim:
    "Cayma bildirimi yazılı olarak (posta veya e-posta), SATICI'nın KEP adresi üzerinden ya da sitedeki cayma formu (/iptal-iade-cayma sayfasındaki örnek form) aracılığıyla SATICI'ya yapılır.",
  alici:
    "ALICI, cayma bildirimini yaptığı tarihten itibaren 14 gün içinde ürünü, SATICI'nın bildireceği taşıyıcıya teslim ederek iade eder. Ürünün hasarsız taşınması için orijinal ambalajıyla iade edilmesi mümkünse tavsiye edilir; şart değildir.",
  satici:
    "SATICI, ürünün iade için belirlenen taşıyıcıya tesliminden itibaren 14 gün içinde, teslimat masrafı dahil tahsil edilen tüm ödemeleri ALICI'ya, ödemede kullanılan yöntemle iade eder.",
  istisna:
    "Tüketicinin istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan mallarda cayma hakkı kullanılamaz (Mesafeli Sözleşmeler Yönetmeliği m.15). ALICI, malın mutat kullanım dışında kullanılmasından kaynaklanan değer kaybından sorumludur.",
} as const;

export const AYIPLI_MAL =
  "Teslim edilen ürün ayıplı çıkarsa ALICI, 6502 sayılı Tüketicinin Korunması Hakkında Kanun'un ayıplı mala ilişkin hükümleri uyarınca; ürünü geri vererek bedel iadesi, bedelden indirim, ücretsiz onarım veya ayıpsız misli ile değiştirilmesini talep etme haklarına sahiptir. Ayıp bildirimi yasal sürelerde SATICI'ya iletilir; kargo teslimi sırasında görülen hasar tutanakla belgelenmelidir.";

export const ODEME =
  "Ödeme, ALICI'nın seçimine göre PayTR altyapısı üzerinden kredi/banka kartı (3D Secure, peşin veya taksitli) ile ya da SATICI'nın banka hesabına Havale/EFT yoluyla yapılır. Havale/EFT'de sipariş, ödemenin SATICI tarafından onaylanmasıyla işleme alınır.";

export const TESLIMAT_SURESI =
  "Siparişler genellikle ödemenin onaylanmasından sonra 1-3 iş günü içinde kargoya verilir; teslimat, her halükarda sipariş tarihinden itibaren 30 günlük yasal süreyi aşmaz.";

export const MONTAJ_NOTU =
  "Ürünler birleştirilmiş (montajlı) olarak gönderilir; evin tavanına montaj hizmeti verilmemektedir.";
