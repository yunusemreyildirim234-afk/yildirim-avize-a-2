"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { ADDRESS_LINE, PHONE_DISPLAY } from "@/lib/site";

export interface ContractData {
  name: string;
  email: string;
  phone: string;
  address: string;
  region: string;
  items: { title: string; variation: string; quantity: number; price: number }[];
  itemsTotal: number;
  shippingLabel: string;
  shippingCost: number;
  discount: number;
  total: number;
  paymentLabel: string;
}

const tl = (n: number) => `${n.toLocaleString("tr-TR")} ₺`;

/** Sipariş bilgilerini dinamik basan Ön Bilgilendirme Formu / Mesafeli Satış Sözleşmesi penceresi. */
export default function ContractModal({ kind, data, onClose }: { kind: "pre" | "sales"; data: ContractData; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const title = kind === "pre" ? "Ön Bilgilendirme Formu" : "Mesafeli Satış Sözleşmesi";
  const today = new Date().toLocaleDateString("tr-TR");
  const h = "text-xs font-bold text-neutral-900 mt-4 mb-1";

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-zinc-950/60" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
          <h2 className="text-base font-serif font-bold text-neutral-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="rounded-full p-1.5 hover:bg-neutral-100">
            <X aria-hidden="true" className="w-5 h-5 text-neutral-600" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 text-xs text-neutral-700 leading-relaxed">
          <p className="text-neutral-500">Tarih: {today}</p>

          <h3 className={h}>1. SATICI</h3>
          <p>Yıldırım Avize Aydınlatma — {ADDRESS_LINE} — Tel: {PHONE_DISPLAY}</p>

          <h3 className={h}>2. ALICI</h3>
          <p>
            Ad Soyad: <strong>{data.name || "—"}</strong>
            <br />E-posta: {data.email || "—"} • Telefon: {data.phone || "—"}
            <br />Teslimat Adresi: {data.address || "—"} {data.region && `(${data.region})`}
          </p>

          <h3 className={h}>3. SÖZLEŞME KONUSU ÜRÜNLER</h3>
          <table className="w-full border-collapse mt-1">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-neutral-200">
                <th className="py-1.5 font-semibold">Ürün</th>
                <th className="py-1.5 font-semibold text-center">Adet</th>
                <th className="py-1.5 font-semibold text-right">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((i, idx) => (
                <tr key={idx} className="border-b border-neutral-100">
                  <td className="py-1.5 pr-2">
                    {i.title} <span className="text-neutral-400">({i.variation})</span>
                  </td>
                  <td className="py-1.5 text-center">{i.quantity}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">{tl(i.price * i.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 space-y-0.5 text-right">
            <p>Ürünler Toplamı: {tl(data.itemsTotal)}</p>
            <p>
              Teslimat ({data.shippingLabel}): {data.shippingCost === 0 ? "Ücretsiz" : tl(data.shippingCost)}
            </p>
            {data.discount > 0 && <p className="text-emerald-700">İndirimler: -{tl(data.discount)}</p>}
            <p className="text-sm font-bold text-neutral-900">Toplam (KDV dahil): {tl(data.total)}</p>
            <p className="text-neutral-500">Ödeme yöntemi: {data.paymentLabel}</p>
          </div>

          {kind === "pre" ? (
            <>
              <h3 className={h}>4. ÜRÜNÜN TEMEL NİTELİKLERİ</h3>
              <p>Ürünlerin temel nitelikleri, ölçüleri ve satış fiyatı ilgili ürün sayfasında yer almaktadır. Ampuller ürüne dahil değildir. Özel ölçü, zincir/kablo/bakla uzunluğu talepleri sipariş notunda belirtilebilir.</p>
              <h3 className={h}>5. TESLİMAT</h3>
              <p>Ürünler, ödemenin onaylanmasından sonra seçilen teslimat yöntemine göre (mağazadan teslim veya sigortalı korumalı koli ile kargo) en geç 30 gün içinde teslim edilir. Kargo bedeli yukarıda belirtilmiştir.</p>
              <h3 className={h}>6. CAYMA HAKKI</h3>
              <p>ALICI, ürünü teslim aldığı tarihten itibaren 14 gün içinde herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin cayma hakkına sahiptir. Cayma bildirimi {PHONE_DISPLAY} veya sitedeki iletişim kanalları üzerinden yapılır. Kişiye özel ölçü ve üretim talepleri ile ambalajı açılmış, kullanılmış ürünlerde cayma hakkı Mesafeli Sözleşmeler Yönetmeliği&apos;nde belirtilen istisnalara tabidir. Ürün, hasarsız ve eksiksiz iade edilmelidir.</p>
              <h3 className={h}>7. UYUŞMAZLIKLAR</h3>
              <p>Şikâyet ve itirazlar için ALICI, bulunduğu yerdeki Tüketici Hakem Heyeti veya Tüketici Mahkemesi&apos;ne başvurabilir.</p>
            </>
          ) : (
            <>
              <h3 className={h}>4. GENEL HÜKÜMLER</h3>
              <p>ALICI, sipariş verdiği ürünün temel nitelikleri, satış fiyatı, ödeme şekli ve teslimata ilişkin ön bilgileri okuyup bilgi sahibi olduğunu ve elektronik ortamda onayladığını kabul eder. SATICI, ürünü sözleşmede belirtilen niteliklere uygun, sağlam ve eksiksiz teslim etmekle yükümlüdür.</p>
              <h3 className={h}>5. TESLİMAT VE RİSK</h3>
              <p>Ürün, ALICI&apos;nın belirttiği adrese veya mağazadan teslim seçildiyse Şişhane mağazasında teslim edilir. Kargo teslimi sırasında paket hasarlıysa ALICI tutanak tutturarak teslim almamalıdır. Teslimata kadar ürün SATICI&apos;nın sorumluluğundadır.</p>
              <h3 className={h}>6. CAYMA HAKKI VE İADE</h3>
              <p>ALICI, teslimden itibaren 14 gün içinde cayma hakkını kullanabilir. Cayma halinde ürün bedeli, iade ürünün SATICI&apos;ya ulaşmasından itibaren 14 gün içinde ALICI&apos;ya iade edilir. Kişiye özel hazırlanan ürünler ve ambalajı açılmış/kullanılmış ürünler istisna kapsamındadır.</p>
              <h3 className={h}>7. YETKİLİ MAHKEME</h3>
              <p>Bu sözleşmeden doğan uyuşmazlıklarda Ticaret Bakanlığı tarafından ilan edilen değere kadar ALICI veya SATICI&apos;nın bulunduğu yerdeki Tüketici Hakem Heyetleri, bu değerin üzerinde Tüketici Mahkemeleri yetkilidir.</p>
            </>
          )}

          <p className="mt-4 text-neutral-500">
            Tam metin için{" "}
            <a href="/mesafeli-satis-sozlesmesi" target="_blank" rel="noopener noreferrer" className="text-amber-700 underline">
              Mesafeli Satış Sözleşmesi sayfasına
            </a>{" "}
            bakabilirsiniz.
          </p>
        </div>

        <div className="px-5 py-3 border-t border-neutral-100 shrink-0 text-right">
          <button type="button" onClick={onClose} className="bg-neutral-900 hover:bg-amber-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors">
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
