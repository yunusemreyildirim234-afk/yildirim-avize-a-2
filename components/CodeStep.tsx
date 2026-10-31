"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

/** 6 haneli kod girişi + 60 sn geri sayımlı "tekrar gönder". */
export default function CodeStep({
  email,
  initialWait = 60,
  busy,
  onSubmit,
  onResend,
  submitLabel = "Kodu Doğrula",
}: {
  email: string;
  initialWait?: number;
  busy: boolean;
  onSubmit: (code: string) => void;
  onResend: () => Promise<number | null>; // yeni bekleme süresi (sn); başarısızsa null
  submitLabel?: string;
}) {
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(initialWait);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const resend = async () => {
    const next = await onResend();
    if (next !== null) {
      setWait(next);
      toast.success("Yeni kod gönderildi");
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <p className="text-neutral-600">
        <strong className="break-all">{email}</strong> adresine 6 haneli doğrulama kodu gönderdik. Kod 10 dakika geçerlidir.
      </p>
      <input
        aria-label="6 haneli doğrulama kodu"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="______"
        className="w-full p-3 text-center text-2xl font-mono tracking-[0.5em] rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600"
      />
      <button
        type="button"
        disabled={busy || code.length !== 6}
        onClick={() => onSubmit(code)}
        className="w-full bg-neutral-900 hover:bg-amber-600 text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-50"
      >
        {busy ? "Doğrulanıyor..." : submitLabel}
      </button>
      <button
        type="button"
        disabled={wait > 0 || busy}
        onClick={resend}
        className="w-full text-neutral-600 hover:text-amber-700 disabled:text-neutral-400 font-semibold py-1"
      >
        {wait > 0 ? `Yeni kod için ${wait} sn bekleyin` : "Kodu tekrar gönder"}
      </button>
    </div>
  );
}
