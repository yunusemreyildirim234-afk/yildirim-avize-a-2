"use client";

import { useState } from "react";
import type { ActivityRow } from "@/lib/activity";
import AdminDeleteButton from "@/components/AdminDeleteButton";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const dur = (m: number) => (m < 1 ? "1 dakikadan az" : m < 60 ? `${m} dk` : `${Math.floor(m / 60)} sa ${m % 60} dk`);

function Row({ r, guest }: { r: ActivityRow; guest: boolean }) {
  const quiet = !r.lastAt;
  return (
    <li className="p-5 space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <strong className="text-neutral-900">{r.name ?? (guest ? "Misafir" : "Müşteri")}</strong>
        <span className="text-neutral-600 break-all">{r.email ?? "E-posta bilinmiyor (anonim oturum)"}</span>
        {r.isAdmin && <span className="bg-neutral-900 text-white font-bold text-[10px] px-2 py-0.5 rounded-full">Yönetici hesabı</span>}
        {r.errors.length > 0 && <span className="bg-red-100 text-red-800 font-bold text-[10px] px-2 py-0.5 rounded-full">{r.errors.length} hata</span>}
        <AdminDeleteButton
          endpoint="/api/admin/activity"
          payload={{ keys: [r.key] }}
          label="Kaydı Sil"
          confirmText={guest ? "Bu misafirin 3 günlük hareket kayıtları silinecek." : "Bu üyenin 3 günlük hareket kayıtları silinecek (üye hesabı silinmez)."}
          disabled={quiet}
          className="ml-auto"
        />
      </div>
      <p className="text-neutral-500">
        {r.registeredAt && <>Kayıt: {fmt(r.registeredAt)} • </>}
        {quiet ? "Son 3 günde hareket yok" : <>İlk işlem: {fmt(r.firstAt)} • Son görülme: {fmt(r.lastAt)} • İlk-son işlem arası: {dur(r.activeMinutes)}</>}
      </p>
      {r.searches.length > 0 && (
        <p>
          <span className="font-semibold text-neutral-700">Aramalar:</span> {r.searches.slice(-8).join(", ")}
        </p>
      )}
      {r.cartAdds.length > 0 && (
        <p>
          <span className="font-semibold text-neutral-700">Sepete eklenenler:</span> {r.cartAdds.slice(-6).join(" • ")}
        </p>
      )}
      {r.checkoutStarts > 0 && <p className="text-neutral-700">Ödeme adımına geçti ({r.checkoutStarts} kez)</p>}
      {r.errors.length > 0 && (
        <ul className="space-y-1">
          {r.errors.slice(-5).map((e, i) => (
            <li key={i} className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-2.5 py-1.5">
              <span className="font-bold">{fmt(e.at)}</span> • {e.page ?? "—"} → {e.detail}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// Son 3 günlük müşteri hareketi: üyeler ve misafirler ayrı sekmelerde
export default function AdminActivity({ registered, guests, ok }: { registered: ActivityRow[]; guests: ActivityRow[]; ok: boolean }) {
  const [tab, setTab] = useState<"reg" | "guest">("reg");
  const [hideAdmin, setHideAdmin] = useState(true); // yönetici/test etkinlikleri varsayılan olarak gizli
  const visibleRegistered = hideAdmin ? registered.filter((r) => !r.isAdmin) : registered;
  const list = tab === "reg" ? visibleRegistered : guests;
  const chip = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
  const on = "bg-neutral-900 border-neutral-900 text-white";
  const off = "bg-white border-neutral-300 text-neutral-600";
  return (
    <div>
      <div role="group" aria-label="Müşteri türü" className="flex flex-wrap gap-2 px-6 py-4 border-b border-neutral-100">
        <button type="button" aria-pressed={tab === "reg"} onClick={() => setTab("reg")} className={`${chip} ${tab === "reg" ? on : off}`}>
          Kayıtlı Müşteriler (E-posta ile Üye Olanlar) <span className="opacity-70">({visibleRegistered.length})</span>
        </button>
        <button type="button" aria-pressed={tab === "guest"} onClick={() => setTab("guest")} className={`${chip} ${tab === "guest" ? on : off}`}>
          Misafir Müşteriler <span className="opacity-70">({guests.length})</span>
        </button>
      </div>
      <label className="flex items-center gap-2 px-6 pt-3 text-[11px] font-semibold text-neutral-600 cursor-pointer w-fit">
        <input type="checkbox" checked={hideAdmin} onChange={(e) => setHideAdmin(e.target.checked)} className="accent-amber-600" />
        Yönetici/test etkinliklerini gizle
      </label>
      <div className="flex justify-end px-6 pt-3">
        <AdminDeleteButton
          endpoint="/api/admin/activity"
          payload={{ scope: tab === "reg" ? "registered" : "guests" }}
          label="Bu Sekmedeki Tüm Hareket Kayıtlarını Temizle"
          confirmText={tab === "reg" ? "Kayıtlı müşterilerin tüm hareket kayıtları silinecek (hesaplar silinmez)." : "Tüm misafir hareket kayıtları silinecek."}
          disabled={list.every((r) => !r.lastAt)}
        />
      </div>
      {!ok ? (
        <p className="p-10 text-center text-xs text-neutral-400">Hareket kayıtları şu an okunamadı.</p>
      ) : list.length === 0 ? (
        <p className="p-10 text-center text-xs text-neutral-400">Son 3 günde kayıtlı hareket yok.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 max-h-[70vh] overflow-y-auto">
          {list.map((r) => (
            <Row key={r.key} r={r} guest={tab === "guest"} />
          ))}
        </ul>
      )}
    </div>
  );
}
