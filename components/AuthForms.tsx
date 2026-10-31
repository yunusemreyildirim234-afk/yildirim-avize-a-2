"use client";

import { useState } from "react";
import { toast } from "sonner";
import CodeStep from "@/components/CodeStep";
import PasswordFields, { passwordsOk } from "@/components/PasswordFields";

type Mode = "login" | "register" | "forgot";
type Step = "form" | "code" | "password" | "twofactor";

const inputCls = "w-full p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600";
const primaryBtn =
  "w-full bg-neutral-900 hover:bg-amber-600 text-white font-semibold py-3.5 rounded-xl transition-colors shadow-sm disabled:opacity-50 mt-2";

async function post(url: string, body: object) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

/** Giriş, doğrulama kodlu kayıt, şifremi unuttum ve 2FA girişi. */
export default function AuthForms({ onAuthenticated }: { onAuthenticated: (user: unknown) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [initialWait, setInitialWait] = useState(60);

  const normEmail = email.trim().toLowerCase();
  const codeType = mode === "register" ? "REGISTER" : "RESET_PASSWORD";

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep("form");
    setPassword("");
    setConfirm("");
    setProof("");
  };

  const finish = (user: unknown) => {
    onAuthenticated(user);
    window.dispatchEvent(new Event("ya-auth"));
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { ok, data } = await post("/api/auth", { action: "login", email: normEmail, password });
      if (data.twoFactor) {
        setPendingToken(data.pendingToken);
        setInitialWait(data.retryAfter ?? 60);
        setStep("twofactor");
      } else if (ok && data.success) finish(data.user);
      else toast.error(data.error || "Giriş başarısız.");
    } catch {
      toast.error("Bağlantı hatası oluştu.");
    } finally {
      setBusy(false);
    }
  };

  // Kayıt / şifremi unuttum: 1) kodu gönder
  const sendCode = async (e?: React.FormEvent): Promise<number | null> => {
    e?.preventDefault();
    setBusy(true);
    try {
      const { ok, data } = await post("/api/auth/send-code", { email: normEmail, type: codeType });
      if (ok) {
        setInitialWait(60);
        setStep("code");
        return 60;
      }
      if (data.retryAfter) {
        setInitialWait(data.retryAfter);
        setStep("code");
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

  // 2) kodu doğrula
  const verify = async (code: string) => {
    setBusy(true);
    try {
      const { ok, data } = await post("/api/auth/verify-code", { email: normEmail, type: codeType, code });
      if (ok && data.proof) {
        setProof(data.proof);
        setStep("password");
      } else toast.error(data.error || "Kod doğrulanamadı.");
    } catch {
      toast.error("Bağlantı hatası oluştu.");
    } finally {
      setBusy(false);
    }
  };

  // 3) şifre belirle
  const setNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsOk(password, confirm)) return;
    setBusy(true);
    try {
      const { ok, data } = await post("/api/auth", {
        action: mode === "register" ? "register" : "reset",
        name,
        email: normEmail,
        password,
        proof,
      });
      if (!ok || !data.success) return void toast.error(data.error || "İşlem başarısız.");
      if (mode === "register") finish(data.user);
      else {
        toast.success("Şifreniz güncellendi", { description: "Yeni şifrenizle giriş yapabilirsiniz." });
        switchMode("login");
      }
    } catch {
      toast.error("Bağlantı hatası oluştu.");
    } finally {
      setBusy(false);
    }
  };

  const verify2fa = async (code: string) => {
    setBusy(true);
    try {
      const { ok, data } = await post("/api/auth/verify-code", { email: normEmail, type: "TWO_FACTOR_LOGIN", code, pendingToken });
      if (ok && data.success) finish(data.user);
      else toast.error(data.error || "Kod doğrulanamadı.");
    } catch {
      toast.error("Bağlantı hatası oluştu.");
    } finally {
      setBusy(false);
    }
  };

  // 2FA kodunu yeniden iste: şifre adımını tekrarlar (sunucu 60 sn sınırını uygular)
  const resend2fa = async (): Promise<number | null> => {
    const { data } = await post("/api/auth", { action: "login", email: normEmail, password });
    if (data.twoFactor && !data.retryAfter) return 60;
    if (data.twoFactor) {
      setPendingToken(data.pendingToken);
      toast.error("Lütfen yeni kod istemeden önce 60 saniye bekleyin.");
      return data.retryAfter;
    }
    toast.error(data.error || "Kod gönderilemedi.");
    return null;
  };

  if (step === "twofactor") {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-serif font-bold text-neutral-900">İki Aşamalı Doğrulama</h2>
          <p className="text-xs text-neutral-500">E-postanıza Gönderilen 6 Haneli Kodu Girin</p>
        </div>
        <CodeStep email={normEmail} initialWait={initialWait} busy={busy} onSubmit={verify2fa} onResend={resend2fa} submitLabel="Giriş Yap" />
        <button type="button" onClick={() => switchMode("login")} className="w-full text-xs text-neutral-500 hover:text-amber-700">
          ← Geri dön
        </button>
      </div>
    );
  }

  if (mode === "login") {
    return (
      <>
        <div className="flex bg-neutral-100 p-1 rounded-2xl text-xs font-semibold">
          <button type="button" className="flex-1 py-2.5 rounded-xl bg-white text-neutral-900 shadow-sm">Giriş Yap</button>
          <button type="button" onClick={() => switchMode("register")} className="flex-1 py-2.5 rounded-xl text-neutral-500 hover:text-neutral-900">
            Kayıt Ol
          </button>
        </div>
        <form onSubmit={login} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-neutral-700 block mb-1">E-posta Adresi</label>
            <input aria-label="E-posta adresi" required type="email" autoComplete="email" placeholder="ornek@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="font-semibold text-neutral-700 block mb-1">Şifre</label>
            <input aria-label="Şifre" required type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
            <button type="button" onClick={() => switchMode("forgot")} className="mt-2 text-amber-700 hover:underline font-semibold">
              Şifremi Unuttum?
            </button>
          </div>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? "İşleniyor..." : "Giriş Yap"}
          </button>
        </form>
      </>
    );
  }

  // Kayıt ve şifremi unuttum: ortak 3 adım
  const isRegister = mode === "register";
  return (
    <>
      {isRegister ? (
        <div className="flex bg-neutral-100 p-1 rounded-2xl text-xs font-semibold">
          <button type="button" onClick={() => switchMode("login")} className="flex-1 py-2.5 rounded-xl text-neutral-500 hover:text-neutral-900">Giriş Yap</button>
          <button type="button" className="flex-1 py-2.5 rounded-xl bg-white text-neutral-900 shadow-sm">Kayıt Ol</button>
        </div>
      ) : (
        <div className="text-center space-y-1">
          <h2 className="text-lg font-serif font-bold text-neutral-900">Şifremi Unuttum</h2>
          <p className="text-xs text-neutral-500">E-posta adresinize gönderilen kodla yeni şifre belirleyin.</p>
        </div>
      )}

      {step === "form" && (
        <form onSubmit={sendCode} className="space-y-4 text-xs">
          {isRegister && (
            <div>
              <label className="font-semibold text-neutral-700 block mb-1">Adınız Soyadınız</label>
              <input aria-label="Adınız Soyadınız" required type="text" placeholder="Ad Soyad" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
          )}
          <div>
            <label className="font-semibold text-neutral-700 block mb-1">E-posta Adresi</label>
            <input aria-label="E-posta adresi" required type="email" autoComplete="email" placeholder="ornek@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
          <button type="submit" disabled={busy || (isRegister && name.trim().length < 2)} className={primaryBtn}>
            {busy ? "Gönderiliyor..." : "Doğrulama Kodu Gönder"}
          </button>
          {!isRegister && (
            <button type="button" onClick={() => switchMode("login")} className="w-full text-neutral-500 hover:text-amber-700">
              ← Girişe dön
            </button>
          )}
        </form>
      )}

      {step === "code" && (
        <CodeStep email={normEmail} initialWait={initialWait} busy={busy} onSubmit={verify} onResend={() => sendCode()} />
      )}

      {step === "password" && (
        <form onSubmit={setNewPassword} className="space-y-4 text-xs">
          <p className="text-emerald-700 font-semibold">✓ E-posta adresiniz doğrulandı. Şimdi güçlü bir şifre belirleyin.</p>
          <PasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} label={isRegister ? "Şifre" : "Yeni Şifre"} />
          <button type="submit" disabled={busy || !passwordsOk(password, confirm)} className={primaryBtn}>
            {busy ? "İşleniyor..." : isRegister ? "Hesap Oluştur" : "Şifreyi Güncelle"}
          </button>
        </form>
      )}
    </>
  );
}
