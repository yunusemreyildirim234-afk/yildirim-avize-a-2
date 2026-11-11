# Kayıtlı Teslimat Adresleri: KVKK Aydınlatma Metni TASLAĞI

> **TASLAK.** Bu metin henüz sitede yayınlanmamıştır; `app/aydinlatma-metni` sayfasına ve `lib/legal-texts.ts` içine **konmamıştır**.
> Yayınlanmadan önce avukat/KVKK danışmanı tarafından incelenmeli ve mevcut Aydınlatma Metni'ne uygun bir madde olarak eklenmelidir.

## Eklenecek madde (öneri)

### Kayıtlı Teslimat Adresleri (Adres Defteri)

**Veri sorumlusu:** Yıldırım Avize (mevcut Aydınlatma Metni'ndeki veri sorumlusu bilgileri geçerlidir).

**İşlenen kişisel veriler.** Hesabınızdaki "Adreslerim" bölümüne kendiniz eklediğiniz adres kayıtları: adres başlığı (ör. "Ev"), alıcı ad soyad, telefon numarası, il, ilçe ve açık adres. Bir adresi varsayılan olarak işaretlediğiniz bilgisi de saklanır.

**İşleme amacı.** Sipariş verirken teslimat formunun hızlıca doldurulması ve siparişinizin belirttiğiniz alıcıya ve adrese teslim edilmesi. Veriler pazarlama, profilleme veya reklam amacıyla kullanılmaz.

**Hukuki sebep.** KVKK m. 5/2 (c) sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (teslimat) ve (f) veri sorumlusunun meşru menfaati (formun kolay doldurulması). Adres kaydı tamamen isteğe bağlıdır; kayıtlı adres olmadan da sipariş verebilirsiniz.

**Saklama süresi.** Adresiniz, siz "Sil" diyene veya hesabınız silinene kadar saklanır. "Sil" ile adres kaydı hemen ve kalıcı olarak silinir. Sipariş verildiğinde teslimat adresi, ilgili sipariş kaydında ayrıca (yasal saklama yükümlülükleri kapsamında) tutulur; kayıtlı adresin silinmesi geçmiş sipariş kayıtlarını etkilemez.

**Aktarım.** Kayıtlı adresleriniz kimseye aktarılmaz. Yalnızca bir sipariş verdiğinizde, o siparişte kullandığınız ad, telefon ve adres teslimat için kargo firmasına (Aras Kargo, Kargonomi altyapısı üzerinden) iletilir.

**Erişim.** Adres defterinize yalnızca hesap sahibi olarak siz erişebilirsiniz. Yönetici panelinde müşterilerin kayıtlı adres listesi görüntülenmez.

**Haklarınız (KVKK m. 11).** Adreslerinizi hesabınızdaki "Adreslerim" bölümünden dilediğiniz zaman görüntüleyebilir, düzeltebilir veya silebilirsiniz. Diğer başvurularınız için mevcut Aydınlatma Metni'ndeki iletişim kanalları kullanılır.

## Avukata / yayın öncesi kontrol listesi

1. **Hesap silme akışı şu an yoktur.** Metindeki "hesabınız silinene kadar" ifadesi yalnızca veritabanı düzeyinde karşılıklıdır (`Address.userId` için `ON DELETE CASCADE`); müşterinin kendisinin hesabını silebileceği bir arayüz/uç **yoktur**. Yayından önce ya bu ifade çıkarılmalı ya da hesap silme akışı eklenmelidir (talep e-postası ile elle silme de belgelenebilir).
2. Hukuki sebep seçimi (5/2-c ve f) avukat tarafından doğrulanmalı; gerekirse açık rıza yerine meşru menfaat gerekçesi yazılmalıdır.
3. Mevcut Aydınlatma Metni'ndeki "işlenen veri kategorileri", "aktarım" ve "saklama" bölümleri bu maddeyle çelişmeyecek şekilde güncellenmelidir.
4. Sepette ve "Adreslerim" bölümünde kullanıcıya gösterilen kısa metin ("Adresleriniz yalnızca siparişlerde formu doldurmak için saklanır…") bu metinle uyumlu tutulmalıdır.
5. "Bu adresi kaydet" kutusu şu an yoktur (adres yalnızca "Adreslerim" bölümünden eklenir). Eklenirse onay metni ayrıca gözden geçirilmelidir.
