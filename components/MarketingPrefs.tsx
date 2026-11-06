"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

type State = { status: "loading" } | { status: "anon" } | { status: "ready"; enabled: boolean } | { status: "error" };
type Source = "hesabim" | "favoriler";

/** E-posta izni (MarketingConsent) okur/günceller. Varsayılan hiçbir zaman açılmaz; yalnızca kullanıcı anahtarı kendisi değiştirince kaydedilir. */
export function useMarketingConsent(source: Source) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/user/marketing", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { anon?: boolean; enabled?: boolean }) => {
        if (alive) setState(d.anon ? { status: "anon" } : { status: "ready", enabled: Boolean(d.enabled) });
      })
      .catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, []);

  const set = useCallback(
    async (enabled: boolean) => {
      setBusy(true);
      try {
        const res = await fetch("/api/user/marketing", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, source }) });
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(d.error ?? "Kaydedilemedi.");
        setState({ status: "ready", enabled });
        toast.success(enabled ? "E-posta bildirimleri açıldı" : "E-posta bildirimleri kapatıldı");
      } catch (e) {
        toast.error((e as Error).message || "Tercihiniz kaydedilemedi.");
      } finally {
        setBusy(false);
      }
    },
    [source]
  );

  return { state, busy, set };
}

function Switch({ checked, busy, label, onChange }: { checked: boolean; busy: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${checked ? "bg-emerald-700" : "bg-zinc-400"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

/** Hesabım → İzinler */
export function MarketingPermissions() {
  const { state, busy, set } = useMarketingConsent("hesabim");
  if (state.status === "anon") return null;
  return (
    <section aria-labelledby="izinler-baslik" className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 shadow-sm space-y-3">
      <h2 id="izinler-baslik" className="text-lg font-serif font-bold text-neutral-900">İzinler</h2>
      {state.status === "loading" && <p className="text-xs text-neutral-500">Yükleniyor...</p>}
      {state.status === "error" && <p className="text-xs text-red-700">İzin durumunuz şu anda okunamadı.</p>}
      {state.status === "ready" && (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">Kampanya, indirim, fırsat ve favori fiyat düşüşü e-postaları</p>
            <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
              {state.enabled ? "Açık: bu e-postaları almak için onay verdiniz." : "Kapalı: size bu türde e-posta göndermiyoruz."} Sipariş ve kargo bilgilendirmeleri bu ayardan etkilenmez.
            </p>
          </div>
          <Switch checked={state.enabled} busy={busy} label="Kampanya ve fiyat düşüşü e-postaları" onChange={set} />
        </div>
      )}
    </section>
  );
}

/** Favoriler sayfasının en üstündeki şerit */
export function FavoritesMarketingStrip() {
  const { state, busy, set } = useMarketingConsent("favoriler");
  if (state.status === "loading" || state.status === "error") return null;
  const box = "max-w-6xl mx-auto mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-neutral-900";
  if (state.status === "anon") {
    return (
      <div className={box}>
        <span>Fiyat düşüşü bildirimi için giriş yapın.</span>
        <Link href="/giris" className="font-semibold text-amber-900 underline underline-offset-2 min-h-11 sm:min-h-0 inline-flex items-center">
          Giriş yap →
        </Link>
      </div>
    );
  }
  return state.enabled ? (
    <div className={box}>
      <span>E-posta bildirimleri açık.</span>
      <button type="button" disabled={busy} onClick={() => set(false)} className="font-semibold text-amber-900 underline underline-offset-2 min-h-11 sm:min-h-0 text-left disabled:opacity-60">
        Kapat
      </button>
    </div>
  ) : (
    <div className={box}>
      <span>Favorilerinizdeki ürünlerin fiyatı düşünce ve kampanyalarda e-posta ile haber almak ister misiniz?</span>
      <span className="flex items-center gap-3 shrink-0">
        <span className="text-xs font-semibold">Fiyat düşüşü ve kampanya e-postaları al</span>
        <Switch checked={false} busy={busy} label="Fiyat düşüşü ve kampanya e-postaları al" onChange={set} />
      </span>
    </div>
  );
}
