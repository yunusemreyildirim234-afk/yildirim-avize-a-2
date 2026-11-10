// Önce/sonra önizleme sayfası (SAF: yalnızca metin üretir). Her görsel için: orijinal + korunan alan, ÖNCE (şu an canlı v1 Blob görseli, varsa), SONRA (v2 çıktısı) ve etiket.
const kac = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
const yuzde = (n) => `${(n * 100).toFixed(2)}%`;

const DURUM = {
  kirpildi: ["Kırpıldı (yalnızca düz beyaz şeritler)", "ok"],
  kirpilmadi: ["Kırpılmadı", "bilgi"],
};
const DOLGU = { beyaz: "dolgu: beyaz", bulanik: "dolgu: bulanık arka plan", yok: "dolgu yok (kareye çok yakın)" };
const dolguEtiketi = (d) => (d ? DOLGU[d.tur] ?? d.tur : "");

/**
 * urunler: [{ modelCode, title, gorseller: [{ url, orijinal, orijinalBayt, kaynak: {w,h}, kutu, durum, dolgu, once: { dosya } | null, sonra: { dosya, buyuk, w, h, baytB, baytK }, tuval, hata? }] }]
 * dosya alanları sayfaya göre göreli yoldur.
 */
export function onizlemeHtml(urunler, { tarih = new Date().toISOString() } = {}) {
  const sekil = (baslik, v) => `<figure><div class="cerceve"><a href="${kac(v.buyuk ?? v.dosya)}" target="_blank" rel="noopener"><img loading="lazy" src="${kac(v.dosya)}" alt=""></a></div><figcaption><strong>${baslik}</strong><br>${v.w} × ${v.h} px · büyük ${kb(v.baytB)} · küçük ${kb(v.baytK)}</figcaption></figure>`;
  const satir = (g) => {
    if (g.hata) return `<div class="satir"><p class="rozet uyari">HATA: ${kac(g.hata)}</p><p class="adres">${kac(g.url)}</p></div>`;
    const [etiket, sinif] = DURUM[g.durum] ?? [g.durum, "bilgi"];
    const k = g.kutu;
    const kutu = `<span class="kutu" style="left:${yuzde(k.left / g.kaynak.w)};top:${yuzde(k.top / g.kaynak.h)};width:${yuzde(k.width / g.kaynak.w)};height:${yuzde(k.height / g.kaynak.h)}"></span>`;
    const once = g.once ? `<figure><div class="cerceve"><img loading="lazy" src="${kac(g.once.dosya)}" alt=""></div><figcaption><strong>ÖNCE</strong> (şu an canlı, v1)</figcaption></figure>` : `<figure><div class="cerceve bos">v1 yok (henüz taşınmamış)</div><figcaption><strong>ÖNCE</strong></figcaption></figure>`;
    return `<div class="satir"><p><span class="rozet ${sinif}">${kac(etiket)}</span> <span class="rozet bilgi">${kac(dolguEtiketi(g.dolgu))}</span> <span class="adres">${kac(g.url)}</span></p><div class="uclu">
<figure><div class="cerceve"><div class="ust"><img loading="lazy" src="${kac(g.orijinal)}" alt="">${kutu}</div></div><figcaption><strong>Orijinal</strong> (kırmızı çerçeve: korunan alan, pay yok)<br>${g.kaynak.w} × ${g.kaynak.h} px · ${kb(g.orijinalBayt)}</figcaption></figure>
${once}
${sekil(`SONRA (v2, --tuval ${g.tuval})`, g.sonra)}
</div></div>`;
  };
  const bolum = (u) => `<section><h2>${kac(u.modelCode ?? "—")} · ${kac(u.title)}</h2>${u.gorseller.map(satir).join("\n")}</section>`;
  // Dikiş kontrolü için bulanık dolgulu ilk görselin büyük (tam boy) hâli
  const ornek = urunler.flatMap((u) => u.gorseller).find((g) => !g.hata && g.dolgu?.tur === "bulanik");
  const buyukOrnek = ornek ? `<section><h2>Dikiş kontrolü (büyük örnek: bulanık dolgulu ilk görsel)</h2><p class="ozet">Fotoğraf ile dolgu birleşiminde dikey/yatay çizgi olmamalı. Tam boy için görsele tıklayın.</p><a href="${kac(ornek.sonra.buyuk ?? ornek.sonra.dosya)}" target="_blank" rel="noopener"><img class="dev" src="${kac(ornek.sonra.buyuk ?? ornek.sonra.dosya)}" alt=""></a></section>` : "";
  const toplam = urunler.reduce((n, u) => n + u.gorseller.length, 0);
  const uyari = urunler.reduce((n, u) => n + u.gorseller.filter((g) => g.hata).length, 0);
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Görsel önizleme</title>
<style>
body{margin:0;padding:24px;font:14px/1.5 system-ui,sans-serif;background:#27272a;color:#f4f4f5}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:32px 0 8px;padding-top:16px;border-top:1px solid #52525b}
.ozet{color:#d4d4d8;margin:0 0 8px}.satir{margin:0 0 24px}.adres{color:#a1a1aa;font-size:11px;word-break:break-all}
.uclu{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start}
@media(max-width:800px){.uclu{grid-template-columns:1fr}}
figure{margin:0}.cerceve{background:#52525b;padding:8px;border-radius:8px;display:flex;justify-content:center}
.dev{display:block;width:min(100%,1000px);height:auto;background:#52525b}
.cerceve.bos{align-items:center;min-height:120px;color:#d4d4d8;font-size:12px}
.cerceve img{display:block;max-width:100%;max-height:420px;height:auto}
.ust{position:relative;display:inline-block;line-height:0}.kutu{position:absolute;border:2px solid #ef4444;box-sizing:border-box;pointer-events:none}
figcaption{font-size:12px;color:#d4d4d8;margin-top:6px}
.rozet{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600}
.ok{background:#065f46;color:#d1fae5}.bilgi{background:#3f3f46;color:#e4e4e7}.uyari{background:#b45309;color:#fff}
</style></head><body>
<h1>Görsel önizleme (kuru çalıştırma)</h1>
<p class="ozet">${urunler.length} ürün, ${toplam} görsel · ${uyari} uyarı · ${kac(tarih)}</p>
<p class="ozet">Koyu zemin, tuvalin kenarlarını gösterir. Her görsel kare tuvaldedir; hiçbir ürün pikseli kesilmez, kırpma yalnızca düz beyaz şeritleri atar. Hiçbir şey yüklenmedi, veritabanına yazılmadı.</p>
${buyukOrnek}
${urunler.map(bolum).join("\n")}
</body></html>
`;
}
