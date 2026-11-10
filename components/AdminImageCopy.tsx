"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { COPY_OVERWRITE_NOTE, copyConfirmText } from "@/lib/image-copy-ui";

interface BatchReply {
  kopyalanan: number;
  hatalar: { productId: string; url: string; hata: string }[];
  atlananUrun: string[];
  kalan: number;
  sirada: number;
  yazma: number;
  error?: string;
}

/** Trendyol adresiyle kalan görselleri parti parti sunucuda Blob'a kopyalar (tarayıcı döngüsü). */
export default function AdminImageCopy({ pending, imagesMode }: { pending: number; imagesMode: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(pending);
  const [total, setTotal] = useState(0);
  const [copied, setCopied] = useState(0);
  const [done, setDone] = useState(0); // kopyalanan + hata alan (ilerleme çubuğu)
  const [errors, setErrors] = useState<{ url: string; hata: string }[]>([]);
  const [msg, setMsg] = useState("");
  const stop = useRef(false);

  const run = async () => {
    if (running || pending === 0) return;
    if (!window.confirm(copyConfirmText(pending, imagesMode))) return;
    stop.current = false;
    setRunning(true);
    setErrors([]);
    setMsg("");
    const start = pending;
    setRemaining(start);
    setTotal(start);
    setCopied(0);
    setDone(0);
    const failed = new Set<string>();
    const errs: { url: string; hata: string }[] = [];
    let ok = 0;
    let stalls = 0;
    let note = "";
    try {
      while (!stop.current) {
        const res = await fetch("/api/admin/gorsel-kopyala", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ atla: [...failed] }) }).catch(() => null);
        if (!res) {
          note = "Bağlantı hatası; durduruldu. Yeniden başlatınca kaldığı yerden sürer.";
          break;
        }
        const r: BatchReply = await res.json().catch(() => ({}) as BatchReply);
        if (!res.ok) {
          note = r.error || "Kopyalama başarısız; durduruldu.";
          break;
        }
        ok += r.kopyalanan;
        for (const h of r.hatalar) {
          failed.add(h.url);
          errs.push({ url: h.url, hata: h.hata });
        }
        setRemaining(r.kalan);
        setCopied(ok);
        setErrors([...errs]);
        setDone(Math.min(start, start - r.sirada));
        stalls = r.kopyalanan === 0 && r.hatalar.length === 0 ? stalls + 1 : 0;
        if (r.sirada === 0) break;
        if (stalls >= 2) {
          note = "İlerleme olmadı (ürünler arada değişmiş olabilir); durduruldu. Daha sonra tekrar deneyin.";
          break;
        }
      }
    } finally {
      setRunning(false);
      setMsg(note || (stop.current ? `Durduruldu: ${ok} görsel kopyalandı.` : `Bitti: ${ok} görsel kopyalandı, ${errs.length} hata.`));
      router.refresh();
    }
  };

  const shown = running ? remaining : pending; // çalışırken sunucudan gelen kalan; değilse sunucunun son sayımı (router.refresh ile güncellenir)
  if (shown === 0 && !running && !msg) return null;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div data-testid="gorsel-kopyala" className="space-y-2 bg-amber-50 border border-amber-300 rounded-lg p-3">
      <p data-testid="kopyalanmamis-gorsel" className="text-xs text-amber-900 font-semibold">
        {shown} görsel henüz kopyalanmadı; Trendyol adresinden doğrudan gösteriliyor.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" data-testid="gorsel-kopyala-baslat" onClick={run} disabled={running || shown === 0} className="min-h-11 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-4 rounded-xl transition-colors disabled:opacity-50">
          {running ? "Kopyalanıyor..." : `Görselleri depoya kopyala (${shown} bekliyor)`}
        </button>
        {running && (
          <button type="button" data-testid="gorsel-kopyala-durdur" onClick={() => (stop.current = true)} className="min-h-11 text-xs font-semibold border border-neutral-400 bg-white hover:border-red-600 px-4 rounded-xl">
            Durdur
          </button>
        )}
      </div>
      {(running || total > 0) && (
        <div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Görsel kopyalama ilerlemesi" className="h-2 w-full bg-white border border-amber-300 rounded-full overflow-hidden">
            <div className="h-full bg-amber-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-neutral-700">{copied} kopyalandı, {errors.length} hata, {shown} bekliyor (%{pct})</p>
        </div>
      )}
      <p role="status" aria-live="polite" data-testid="gorsel-kopyala-durum" className="text-xs text-neutral-800 font-semibold">{msg}</p>
      {imagesMode === "OVERWRITE" && (
        <p role="note" data-testid="gorsel-kopyala-ezerek" className="text-xs text-red-900 font-semibold bg-red-50 border border-red-300 rounded-lg p-2">{COPY_OVERWRITE_NOTE}</p>
      )}
      {errors.length > 0 && (
        <details className="text-[11px] text-red-800">
          <summary className="cursor-pointer font-semibold">{errors.length} görsel kopyalanamadı</summary>
          <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
            {errors.map((e) => (
              <li key={e.url} className="break-all">{e.url} — {e.hata}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
