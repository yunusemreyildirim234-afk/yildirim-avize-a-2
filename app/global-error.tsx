"use client";

/** Kök düzen hatası: kendi <html>/<body> etiketlerini sağlar (düzen çalışmadığı için site stilleri yoktur, satır içi stil kullanılır). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, fontFamily: "Georgia, serif", background: "#fafaf9", color: "#171717" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 28, marginBottom: 12 }}>Sayfa şu an açılamadı</h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "#525252", marginBottom: 20 }}>Geçici bir hata oluştu. Lütfen tekrar deneyin.</p>
            <button type="button" onClick={reset} style={{ background: "#171717", color: "#fff", border: 0, borderRadius: 12, padding: "12px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Tekrar Dene
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
