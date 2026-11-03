// Cayma/iade metinleri tek yerde tutulur: sepetteki ön bilgilendirme formu, mesafeli satış sözleşmesi
// ve /iptal-iade-cayma sayfası aynı cümleleri kullanır (metinler birbiriyle çelişmesin).

import { LEGAL_CONTACT_EMAIL, PHONE_DISPLAY } from "@/lib/site";

export const LEGAL_UPDATED = "2 Kasım 2026";

export const CAYMA = {
  hak: "ALICI, malı teslim aldığı tarihten itibaren 14 gün içinde herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayma hakkına sahiptir.",
  bildirim:
    `Cayma bildirimi yazılı olarak; SATICI'nın KEP adresi üzerinden, ${LEGAL_CONTACT_EMAIL} e-posta adresine gönderilecek e-postayla, posta yoluyla ya da sitedeki cayma formu (/iptal-iade-cayma sayfasındaki örnek form) aracılığıyla yapılır.`,
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

/** İade talebi onaylandığında müşteriye gönderilen standart iade talimatı (e-posta ve /iptal-iade-cayma aynı metni kullanır). */
/** Hasarlı/hatalı ürün bildirimi için tek standart cümle */
export const HASAR_BILDIRIMI = "Ürün hasarlı veya hatalı geldiyse lütfen fotoğrafını WhatsApp destek hattımıza iletiniz.";

export const IADE_TALIMATI = `Ürünü hasarsız ve eksiksiz, mümkünse orijinal ambalajıyla, size iletilecek iade kargo kodu/etiketi ile Aras Kargo'ya teslim ediniz. İade kargo bedeli tarafımıza aittir. İade kargo kodu için bu e-postayı yanıtlayabilir veya WhatsApp destek hattımızdan (${PHONE_DISPLAY}) bize ulaşabilirsiniz. Ürün tarafımıza ulaştıktan sonra bedeliniz, ödeme yönteminize uygun olarak yasal süre içinde iade edilir. ${HASAR_BILDIRIMI}`;
