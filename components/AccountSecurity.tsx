"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import CodeStep from "@/components/CodeStep";
import PasswordFields, { passwordsOk } from "@/components/PasswordFields";

async function post(url: string, body: object) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

type Flow = null | "pw-code" | "pw-new" | "2fa-code";

/** Profil: kodla şifre değiştirme ve e-posta ile iki aşamalı doğrulama (2FA) yönetimi. */
export default function AccountSecurity({ email, twoFactorEnabled, onChanged }: { email: string; twoFactorEnabled: boolean; onChanged: () => void }) {
  const [flow, setFlow] = useState<Flow>(null);
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const start = async (type: "CHANGE_PASSWORD" | "TWO_FACTOR_ENABLE", next: Flow): Promise<number | null> => {
    setBusy(true);
    try {
      const { ok, data } = await post("/api/auth/send-code", { type });
      if (ok) {
        setFlow(next);
        return 60;
      }
      toast.error(data.error || "Kod gönderilemedi.");
      return null;
    } catch {
      toast.error("Bağlantı hatası oluştu.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const verifyPw = async (code: string) => {
    setBusy(true);
    const { ok, data } = await post("/api/auth/verify-code", { type: "CHANGE_PASSWORD", code }).catch(() => ({ ok: false, data: {} as Record<string, string> }));
    setBusy(false);
    if (ok && data.proof) {
      setProof(data.proof);
      setFlow("pw-new");
    } else toast.error(data.error || "Kod doğrulanamadı.");
  };

  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsOk(password, confirm)) return;
    setBusy(true);
    const { ok, data } = await post("/api/auth", { action: "change-password", password, proof }).catch(() => ({ ok: false, data: {} as Record<string, string> }));
    setBusy(false);
    if (ok && data.success) {
      toast.success("Şifreniz güncellendi");
      setFlow(null);
      setPassword("");
      setConfirm("");
    } else toast.error(data.error || "Şifre güncellenemedi.");
  };

  const verify2fa = async (code: string) => {
    setBusy(true);
    const { ok, data } = await post("/api/auth/verify-code", { type: "TWO_FACTOR_ENABLE", code }).catch(() => ({ ok: false, data: {} as Record<string, string> }));
    setBusy(false);
    if (ok && data.success) {
      toast.success("İki aşamalı doğrulama etkinleştirildi");
      setFlow(null);
      onChanged();
    } else toast.error(data.error || "Kod doğrulanamadı.");
  };

  const disable2fa = async () => {
    if (!window.confirm("İki aşamalı doğrulamayı kapatmak istediğinize emin misiniz?")) return;
    setBusy(true);
    const { ok, data } = await post("/api/auth", { action: "disable-2fa" }).catch(() => ({ ok: false, data: {} as Record<string, string> }));
    setBusy(false);
    if (ok && data.success) {
      toast.success("İki aşamalı doğrulama kapatıldı");
      onChanged();
    } else toast.error(data.error || "İşlem başarısız.");
  };

  return (
    <div id="guvenlik" className="bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm space-y-6 scroll-mt-24">
      <h2 className="text-lg font-serif font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-2">
        <ShieldCheck aria-hidden="true" className="w-5 h-5 text-amber-600" /> Hesap Güvenliği
      </h2>

      {/* 2FA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs">
          <p className="font-bold text-neutral-900 text-sm">İki Aşamalı Doğrulama (E-posta ile Güvenlik)</p>
          <p className="text-neutral-500 mt-0.5">Girişte şifrenize ek olarak e-postanıza gönderilen 6 haneli kod istenir.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={twoFactorEnabled}
          aria-label="İki aşamalı doğrulama"
          disabled={busy || flow === "2fa-code"}
          onClick={() => (twoFactorEnabled ? disable2fa() : start("TWO_FACTOR_ENABLE", "2fa-code"))}
          className={`shrink-0 w-12 h-7 rounded-full transition-colors relative disabled:opacity-60 ${twoFactorEnabled ? "bg-emerald-500" : "bg-neutral-300"}`}
        >
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${twoFactorEnabled ? "left-6" : "left-1"}`} />
        </button>
      </div>
      {!twoFactorEnabled && flow !== "2fa-code" && (
        <button type="button" disabled={busy} onClick={() => start("TWO_FACTOR_ENABLE", "2fa-code")} className="text-xs font-semibold bg-neutral-900 hover:bg-amber-600 text-white px-4 py-2 rounded-xl transition-colors">
          Etkinleştir
        </button>
      )}
      {flow === "2fa-code" && (
        <div className="max-w-sm">
          <CodeStep email={email} busy={busy} onSubmit={verify2fa} onResend={() => start("TWO_FACTOR_ENABLE", "2fa-code")} submitLabel="Etkinleştirmeyi Onayla" />
        </div>
      )}

      {/* Şifre değiştir */}
      <div className="border-t border-neutral-100 pt-6 space-y-3">
        <p className="font-bold text-neutral-900 text-sm">Şifre Değiştir</p>
        {flow === null || flow === "2fa-code" ? (
          <button type="button" disabled={busy} onClick={() => start("CHANGE_PASSWORD", "pw-code")} className="text-xs font-semibold border border-neutral-300 hover:bg-neutral-50 text-neutral-800 px-4 py-2 rounded-xl transition-colors">
            E-posta ile Kod Gönder
          </button>
        ) : flow === "pw-code" ? (
          <div className="max-w-sm">
            <CodeStep email={email} busy={busy} onSubmit={verifyPw} onResend={() => start("CHANGE_PASSWORD", "pw-code")} />
          </div>
        ) : (
          <form onSubmit={savePw} className="max-w-sm space-y-4 text-xs">
            <PasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} label="Yeni Şifre" />
            <button type="submit" disabled={busy || !passwordsOk(password, confirm)} className="bg-neutral-900 hover:bg-amber-600 text-white font-semibold px-5 py-3 rounded-xl transition-colors disabled:opacity-50">
              {busy ? "Kaydediliyor..." : "Şifreyi Güncelle"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
