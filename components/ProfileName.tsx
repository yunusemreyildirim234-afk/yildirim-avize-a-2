"use client";

import { useState } from "react";
import { toast } from "sonner";

/** Üyenin görünen adını düzenleme. Kayıttan sonra üst menü (ya-auth olayı) ve hesap sayfası yenilenir. */
export default function ProfileName({ name, onChanged }: { name: string; onChanged: () => void }) {
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const clean = value.replace(/\s+/g, " ").trim();
  const dirty = clean !== name;
  const valid = clean.length >= 2 && clean.length <= 60;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || !valid) return;
    setBusy(true);
    try {
      const res = await fetch("/api/user/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: clean }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ad güncellenemedi.");
      setValue(data.name);
      toast.success("Bilgileriniz güncellendi");
      window.dispatchEvent(new Event("ya-auth"));
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="bg-raised rounded-3xl border border-line p-6 shadow-sm space-y-3">
      <h2 className="text-lg font-serif font-bold text-ink">Hesap Bilgilerim</h2>
      <label htmlFor="profile-name" className="block text-xs font-semibold text-ink-muted">
        Ad Soyad / Kullanıcı Adı
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id="profile-name"
          value={value}
          maxLength={60}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={dirty && !valid}
          aria-describedby="profile-name-hint"
          className="flex-1 p-3 rounded-xl border border-line-strong text-sm focus:border-bronze-ink focus-visible:outline-2 focus-visible:outline-bronze-ink"
        />
        <button type="submit" disabled={busy || !dirty || !valid} className="bg-ink hover:bg-bronze-ink disabled:opacity-50 text-canvas text-sm font-semibold px-5 py-3 rounded-xl transition-colors">
          {busy ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
      <p id="profile-name-hint" className={`text-[11px] ${dirty && !valid ? "text-red-700" : "text-ink-muted"}`}>
        2-60 karakter. Siparişlerde ve üst menüde bu ad görünür.
      </p>
    </form>
  );
}
