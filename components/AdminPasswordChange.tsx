"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import CodeStep from "@/components/CodeStep";
import PasswordInput from "@/components/PasswordInput";
import PasswordFields, { passwordsOk } from "@/components/PasswordFields";

async function post(body: object) {
  const res = await fetch("/api/admin/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

const inputCls = "w-full p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600";

/** Yönetici hesabı şifre değiştirme: e-posta + mevcut şifre + yeni şifre → e-postaya kod → değiştir. */
export default function AdminPasswordChange() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"form" | "code">("form");
  const [busy, setBusy] = useState(false);

  const fields = { email, password: current, newPassword: next, confirm };

  const send = async (): Promise<number | null> => {
    setBusy(true);
    try {
      const { ok, data } = await post(fields);
      if (!ok) {
        toast.error(data.error || "Kod gönderilemedi.");
        return null;
      }
      setStep("code");
      return data.retryAfter ?? 60;
    } catch {
      toast.error("Bağlantı hatası oluştu.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const change = async (code: string) => {
    setBusy(true);
    try {
      const { ok, data } = await post({ ...fields, step: "change", code });
      if (!ok) {
        toast.error(data.error || "Şifre değiştirilemedi.");
        return;
      }
      toast.success("Şifre değiştirildi. Diğer yönetici oturumları kapatıldı.");
      setStep("form");
      setCurrent("");
      setNext("");
      setConfirm("");
      router.refresh();
    } catch {
      toast.error("Bağlantı hatası oluştu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <p className="text-xs text-neutral-500">Ortak .env kimliği Vercel ortam değişkenlerinden değiştirilir. Bu bölüm yalnızca veritabanındaki yönetici hesapları içindir.</p>
        <p className="text-xs text-amber-800 font-semibold mt-1">Şifre değişince tüm yönetici oturumları kapanır; diğer yöneticiler yeniden giriş yapmalıdır (bu oturum açık kalır).</p>
      </div>

      {step === "form" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!passwordsOk(next, confirm)) return toast.error("Yeni şifre kurallara uymuyor veya tekrarı eşleşmiyor.");
            void send();
          }}
          className="space-y-3 max-w-md text-xs"
        >
          <div>
            <label htmlFor="apw-mail" className="font-semibold text-neutral-700 block mb-1">Yönetici e-posta adresi</label>
            <input id="apw-mail" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="apw-cur" className="font-semibold text-neutral-700 block mb-1">Mevcut şifre</label>
            <PasswordInput id="apw-cur" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
          </div>
          <PasswordFields password={next} confirm={confirm} onPassword={setNext} onConfirm={setConfirm} label="Yeni şifre" />
          <button type="submit" disabled={busy} className="min-h-11 bg-neutral-900 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold px-5 rounded-xl transition-colors">
            {busy ? "Gönderiliyor..." : "Kod Gönder"}
          </button>
        </form>
      ) : (
        <div className="max-w-sm space-y-3 text-xs">
          <p className="font-semibold text-neutral-800">E-postanıza gelen 6 haneli kodu girin.</p>
          <CodeStep email={email.trim().toLowerCase()} busy={busy} onSubmit={change} onResend={send} submitLabel="Şifreyi Değiştir" />
          <button type="button" onClick={() => setStep("form")} className="underline text-neutral-600">Bilgileri düzenle</button>
        </div>
      )}
    </div>
  );
}
