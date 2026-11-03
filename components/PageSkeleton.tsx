/** Yavaş dinamik sayfalar için hafif Türkçe iskelet (loading.tsx). Ana kapsayıcı yerleşimle aynı: içerik gelince zıplamaz. */
export default function PageSkeleton({ width = "max-w-2xl", bg = "bg-neutral-50", rows = 3 }: { width?: string; bg?: string; rows?: number }) {
  return (
    <main className={`min-h-screen ${bg} py-12 px-4 sm:px-6`} aria-busy="true">
      <div role="status" aria-live="polite" className={`${width} mx-auto space-y-4`}>
        <span className="sr-only">Sayfa yükleniyor…</span>
        <div aria-hidden="true" className="h-8 w-1/2 rounded-lg bg-neutral-200 motion-safe:animate-pulse" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} aria-hidden="true" className="h-28 rounded-2xl bg-neutral-200/70 motion-safe:animate-pulse" />
        ))}
      </div>
    </main>
  );
}
