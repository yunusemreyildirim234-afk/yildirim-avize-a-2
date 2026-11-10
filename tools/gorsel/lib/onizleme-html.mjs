// Önce/sonra önizleme sayfası (SAF: yalnızca metin üretir). Her görsel için: orijinal + kırpma kutusu, (a) kare tuval, (b) oran korunmuş.
const kac = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
const yuzde = (n) => `${(n * 100).toFixed(2)}%`;

const DURUM = {
  kirpildi: ["Kırpıldı", "ok"],
  "kenar-yok": ["Beyaz zemin, kırpılacak kenar yok", "bilgi"],
  "asiri-kirpma": ["Kırpma ATLANDI (ürün çok küçük kalıyordu) — elle bakın", "uyari"],
  "zemin-beyaz-degil": ["Ortam fotoğrafı: kırpılmadı, tuval eklenmedi", "bilgi"],
};

/**
 * urunler: [{ modelCode, title, gorseller: [{ url, orijinal, orijinalBayt, kaynak: {w,h}, kutu, durum, kare: { dosya, w, h, baytB, baytK }, oran: {...}, hata? }] }]
 * dosya alanları sayfaya göre göreli yoldur.
 */
export function onizlemeHtml(urunler, { tarih = new Date().toISOString() } = {}) {
  const sekil = (baslik, g, v) => `<figure><div class="cerceve"><img loading="lazy" src="${kac(v.dosya)}" alt=""></div><figcaption><strong>${baslik}</strong><br>${v.w} × ${v.h} px · büyük ${kb(v.baytB)} · küçük ${kb(v.baytK)}</figcaption></figure>`;
  const satir = (g) => {
    if (g.hata) return `<div class="satir"><p class="rozet uyari">HATA: ${kac(g.hata)}</p><p class="adres">${kac(g.url)}</p></div>`;
    const [etiket, sinif] = DURUM[g.durum] ?? [g.durum, "bilgi"];
    const k = g.kutu;
    const kutu = `<span class="kutu" style="left:${yuzde(k.left / g.kaynak.w)};top:${yuzde(k.top / g.kaynak.h)};width:${yuzde(k.width / g.kaynak.w)};height:${yuzde(k.height / g.kaynak.h)}"></span>`;
    return `<div class="satir"><p><span class="rozet ${sinif}">${kac(etiket)}</span> <span class="adres">${kac(g.url)}</span></p><div class="uclu">
<figure><div class="cerceve"><div class="ust"><img loading="lazy" src="${kac(g.orijinal)}" alt="">${kutu}</div></div><figcaption><strong>Orijinal</strong> (kırmızı çerçeve: korunan alan)<br>${g.kaynak.w} × ${g.kaynak.h} px · ${kb(g.orijinalBayt)}</figcaption></figure>
${sekil("(a) --tuval kare", g, g.kare)}
${sekil("(b) --tuval oran", g, g.oran)}
</div></div>`;
  };
  const bolum = (u) => `<section><h2>${kac(u.modelCode ?? "—")} · ${kac(u.title)}</h2>${u.gorseller.map(satir).join("\n")}</section>`;
  const toplam = urunler.reduce((n, u) => n + u.gorseller.length, 0);
  const uyari = urunler.reduce((n, u) => n + u.gorseller.filter((g) => g.hata || g.durum === "asiri-kirpma").length, 0);
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Görsel önizleme</title>
<style>
body{margin:0;padding:24px;font:14px/1.5 system-ui,sans-serif;background:#27272a;color:#f4f4f5}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:32px 0 8px;padding-top:16px;border-top:1px solid #52525b}
.ozet{color:#d4d4d8;margin:0 0 8px}.satir{margin:0 0 24px}.adres{color:#a1a1aa;font-size:11px;word-break:break-all}
.uclu{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start}
@media(max-width:800px){.uclu{grid-template-columns:1fr}}
figure{margin:0}.cerceve{background:#52525b;padding:8px;border-radius:8px;display:flex;justify-content:center}
.cerceve img{display:block;max-width:100%;max-height:420px;height:auto}
.ust{position:relative;display:inline-block;line-height:0}.kutu{position:absolute;border:2px solid #ef4444;box-sizing:border-box;pointer-events:none}
figcaption{font-size:12px;color:#d4d4d8;margin-top:6px}
.rozet{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600}
.ok{background:#065f46;color:#d1fae5}.bilgi{background:#3f3f46;color:#e4e4e7}.uyari{background:#b45309;color:#fff}
</style></head><body>
<h1>Görsel önizleme (kuru çalıştırma)</h1>
<p class="ozet">${urunler.length} ürün, ${toplam} görsel · ${uyari} uyarı · ${kac(tarih)}</p>
<p class="ozet">Koyu zemin, beyaz tuvalin kenarlarını gösterir. Kristal ve beyaz zeminli ürünlerde kırmızı çerçevenin ürünü kesmediğine bakın. Hiçbir şey yüklenmedi, veritabanına yazılmadı.</p>
${urunler.map(bolum).join("\n")}
</body></html>
`;
}
