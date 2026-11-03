"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import CodeStep from "@/components/CodeStep";
import PasswordInput from "@/components/PasswordInput";

const DISMISS_KEY = "ya-admin-2fa-banner";
const DISMISS_MS = 7 * 24 * 3600_000;

/** 2FA kapalı yönetici hesabı varken kapatılabilir (7 gün) uyarı bandı. */
export function AdminTwoFactorBanner({ missing }: { missing: number }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- depolama ilk render sonrası okunur
      setHidden(Date.now() - at < DISMISS_MS);
    } catch {
      setHidden(false);
    }
  }, []);
  if (missing <= 0 || hidden) return null;
  return (
    <div role="status" className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <ShieldCheck aria-hidden="true" className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
      <p className="flex-1">
        Hesabınızı korumak için 2 aşamalı doğrulamayı açın.{" "}
        <Link href="/admin#guvenlik" className="font-semibold underline underline-offset-2 hover:text-amber-800 focus-visible:outline-2 focus-visible:outline-amber-700">
          Şimdi aç
        </Link>
      </p>
      <button
        type="button"
        aria-label="Uyarıyı kapat"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
          } catch {
            /* depolama kapalı */
          }
          setHidden(true);
        }}
        className="inline-flex items-center justify-center w-11 h-11 -m-2 rounded-xl hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-700"
      >
        <X aria-hidden="true" className="w-4 h-4" />
      </button>
    </div>
  );
}

async function post(body: object) {
  const res = await fetch("/api/admin/two-factor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

/** Yönetici 2FA açma/kapatma: e-posta + şifre ile hesap doğrulanır, e-postaya kod gider (müşterilerdeki akışın aynısı). Kapatma da kod ister. */
export default function AdminTwoFactor() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"form" | "code">("form");
  const [action, setAction] = useState<"ENABLE" | "DISABLE">("ENABLE");
  const [busy, setBusy] = useState(false);

  const send = async (): Promise<number | null> => {
    setBusy(true);
    try {
      const { ok, data } = await post({ email, password });
      if (!ok) {
        toast.error(data.error || "Kod gönderilemedi.");
        return null;
      }
      setAction(data.action);
      setStep("code");
      return data.retryAfter ?? 60;
    } catch {
      toast.error("Bağlantı hatası oluştu.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string) => {
    setBusy(true);
    try {
      const { ok, data } = await post({ step: "verify", email, password, code });
      if (!ok) {
        toast.error(data.error || "Kod doğrulanamadı.");
        return;
      }
      toast.success(data.enabled ? "İki aşamalı doğrulama etkinleştirildi" : "İki aşamalı doğrulama kapatıldı");
      setStep("form");
      setPassword("");
    } catch {
      toast.error("Bağlantı hatası oluştu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="guvenlik" className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-4 scroll-mt-24">
      <div>
        <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="w-4 h-4 text-amber-600" /> İki Aşamalı Doğrulama (Yönetici Hesabı)
        </h3>
        <p className="text-xs text-neutral-500 mt-0.5">
          Hesabınızın e-posta adresi ve şifrenizi girin. Hesabınızda kapalıysa açma, açıksa kapatma kodu e-postanıza gönderilir. Açıkken girişte şifreye ek olarak e-posta kodu istenir.
        </p>
      </div>
      {step === "form" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end text-xs"
        >
          <div>
            <label htmlFor="a2fa-mail" className="font-semibold text-neutral-700 block mb-1">Yönetici e-postası</label>
            <input id="a2fa-mail" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600" />
          </div>
          <div>
            <label htmlFor="a2fa-pass" className="font-semibold text-neutral-700 block mb-1">Şifre</label>
            <PasswordInput id="a2fa-pass" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600" />
          </div>
          <button type="submit" disabled={busy} className="bg-neutral-900 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold px-5 py-3 rounded-xl transition-colors">
            {busy ? "Gönderiliyor..." : "Kod Gönder"}
          </button>
        </form>
      ) : (
        <div className="max-w-sm space-y-3">
          <p className="text-xs font-semibold text-neutral-800">
            {action === "ENABLE" ? "2FA'yı açmak için e-postanıza gelen kodu girin." : "2FA'yı kapatmak için e-postanıza gelen kodu girin."}
          </p>
          <CodeStep email={email.trim().toLowerCase()} busy={busy} onSubmit={verify} onResend={send} submitLabel={action === "ENABLE" ? "Etkinleştir" : "Kapat"} />
          <button type="button" onClick={() => setStep("form")} className="text-xs text-neutral-500 hover:text-amber-700 font-semibold">
            ← Vazgeç
          </button>
        </div>
      )}
    </div>
  );
}
