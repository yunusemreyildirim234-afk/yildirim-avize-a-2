\# Yıldırım Avize (yildirimavize.com.tr) — Proje Geliştirme \& Mimari Yönergeleri



\## 1. İletişim ve Kodlama Felsefesi (Cave Man + Ponytail + Karpathy Modu)

\- Boş nezaket cümleleri ve uzun açıklamalar yapma; doğrudan çözüme ve koda odaklan.

\- \*\*Ponytail \& Karpathy Prensibi:\*\* Fazla kod yazma, en sade ve standart çözümü seç. Projeye yeni NPM paketi/kütüphane ekleme; mevcut yapıyı (Vanilla TS + Next.js + Tailwind) kullan.

\- Kodu parça parça değil, ilgili dosyanın neresine geleceğini net belirterek uygula.



\## 2. Teknoloji Yığını (Tech Stack)

\- \*\*Framework:\*\* Next.js (App Router) + TypeScript (Strict mode, `any` yasak)

\- \*\*Veritabanı:\*\* Prisma ORM + PostgreSQL (Neon)

\- \*\*Stil \& İkon:\*\* Tailwind CSS + `lucide-react`

\- \*\*Ödeme \& Kargo \& Mail:\*\* PayTR (Canlı Mod), Kargonomi (Aras Kargo - ID: 4), Resend API



\## 3. Çalışma Disiplini (Superpowers Modu)

\- Büyük değişikliklerden önce kısa bir uygulama planı çıkar, küçük işlerde doğrudan uygula.

\- Bir hata çıktığında tahmin yürütmek yerine kök nedeni analiz et; çalışan yapıları bozmadan yalnızca hedeflenen bileşeni güncelle.

\- Stok, kupon ve sipariş durumu değişen işlemler atomik olmalı (`stockDeducted` kontrolü ve Prisma transaction).

\- Webhook ve ödeme akışları her zaman idempotent kalmalı.

\- Her aşama sonunda mutlaka `npx tsc --noEmit` ve `npm run build` çalıştırarak sıfır hata doğrula.



\## 4. UI/UX \& Tasarım Prensipleri (Impeccable — Anti-AI Tasarım)

\- \*\*Marka Kimliği:\*\* Yarım asırlık Beyoğlu/Şişhane kristal ve modern avize mağazası. Premium, sıcak (amber/gold/stone/zinc tonları), güven veren kurumsal görünüm.

\- \*\*Anti-AI Kuralı:\*\* Klasik yapay zeka şablonlarından (mor/mavi neon gradyanlar, aşırı parlak ucuz blur efektleri, rastgele yuvarlatılmış kutular) kesinlikle kaçın.

\- \*\*Tipografi \& Boşluk:\*\* Net tipografi hiyerarşisi, okunabilir satır yükseklikleri, tutarlı padding/margin ritmi ve kusursuz mobil uyumluluk (mobile-first).

\- \*\*Görsel Odak:\*\* Ürün fotoğrafları her zaman başrolde olmalı; animasyonlar abartılmadan mikro etkileşim düzeyinde tutulmalı.

\- \*\*Erişilebilirlik:\*\* Yüksek renk kontrastı, anlamlı `alt` metinleri, klavye ile gezinme (`focus-visible`) ve net form hata mesajları.



\## 5. Dokunulmaz Alanlar ve Kesin İş Kuralları

\- \*\*Ödeme \& Kargo:\*\* `/api/paytr/callback`, `/api/paytr/token` ve `lib/kargonomi.ts` içindeki çalışan ödeme/kargo mantığına kesinlikle dokunma.

\- \*\*Güvenlik \& Ortam:\*\* `proxy.ts` admin korumasına (`verifyAdminSession`) dokunma. `.env` dosyalarını okuma, değiştirme veya loglama.

\- \*\*İletişim \& Yasal:\*\* WhatsApp ürün sorma / destek butonlarına ve çerez çubuğuna dokunma.

\- \*\*Banka Alıcı Adı:\*\* `lib/site.ts` içindeki Kuveyt Türk alıcı adı (`holder: "Ömer Yıldırım Ömer Yıldırım"`) resmi banka hesap adı olduğu için çift yazılmaktadır; hata sanıp düzeltme.

\- \*\*İndirim \& Kargo Sabitleri:\*\* 350 TL üzeri ücretsiz kargo, %5 Havale/EFT indirimi, %3 Beyoğlu mağazadan teslim indirimi (`lib/pricing.ts`). Ürünler birleştirilmiş (montajlı) gönderilir; evin tavanına montaj hizmeti yoktur (yalnızca WhatsApp uzaktan teknik destek vardır). SMS bildirimi yoktur (yalnızca e-posta).

\- \*\*ETBİS \& Kurumsal Bilgiler:\*\* Site `.tr` uzantılı (`www.yildirimavize.com.tr`) olduğu için yeni mevzuat gereği ETBİS karekod zorunluluğu yoktur; ETBİS alanı genel sorgulama linki olarak çalışır. Kullanıcının girdiği gerçek KEP adresi, Vergi No ve kurumsal bilgileri koru.



\## 6. Güvenlik Standartları (Security Audit)

\- Her `/api/admin/\*` ucunda `verifyAdminSession` kontrolü zorunludur; `/api/seed` canlı ortamda (`production`) kapalı kalmalıdır.

\- Sipariş, dekont ve yorum görseli erişiminde sahiplik (IDOR) ve misafir 24 saat kuralları korunmalıdır.

\- E-posta gönderimlerinde ve admin görünümünde `cleanGuestEmail` kullanılmalıdır.

\- Dosya yükleme uçlarında Magic Bytes / MIME ve boyut kontrolü; kimlik doğrulama, sipariş ve iletişim uçlarında IP bazlı `rateLimit` zorunludur.

