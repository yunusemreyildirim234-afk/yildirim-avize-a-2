// Sayfa kabuğu (tek <main>, h1, form) bekletmeden gelir; yalnızca sipariş sonucu kendi Suspense iskeletini gösterir (page.tsx).
// Ayrı bir tam sayfa iskeleti ikinci bir <main> ve "Sayfa yükleniyor…" metnini sunucu çıktısına eklediği için burada boş bırakıldı.
export default function Loading() {
  return null;
}
