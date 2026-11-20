"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isShortOrderCode } from "@/lib/order-lookup";

/** /kargo-takip formu. 8 haneli sipariş kodunda e-posta zorunlu olur; girişli kullanıcıda hesabından dolar. Sunucu eylemi değişmez. */
export default function TrackForm({ action, defaultCode }: { action: (formData: FormData) => void | Promise<void>; defaultCode?: string }) {
  const [code, setCode] = useState(defaultCode ?? "");
  const [email, setEmail] = useState("");
  const short = isShortOrderCode(code);

  const { user: account } = useAuth();
  useEffect(() => {
    const mail = account?.email;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- oturum bilgisi geldikten sonra boş alan doldurulur
    if (mail) setEmail((cur) => cur || mail);
  }, [account]);

  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <label htmlFor="code" className="sr-only">
          Sipariş veya takip kodu
        </label>
        <input
          id="code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          placeholder="Sipariş veya takip kodunuz"
          className="flex-1 border border-line-strong rounded-xl px-4 py-3 text-sm bg-raised outline-none focus:border-bronze-ink"
        />
        <label htmlFor="email" className="sr-only">
          E-posta (8 haneli sipariş koduyla sorgularken)
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required={short}
          aria-describedby="email-ipucu"
          placeholder="E-posta (sipariş kodu için)"
          className="sm:w-64 border border-line-strong rounded-xl px-4 py-3 text-sm bg-raised outline-none focus:border-bronze-ink"
        />
        <button type="submit" className="bg-ink hover:bg-bronze-ink text-canvas text-xs font-semibold px-6 py-3 rounded-xl transition-colors">
          Sorgula
        </button>
      </div>
      <p id="email-ipucu" className="text-xs text-ink-muted">
        {short ? "8 haneli sipariş kodu için siparişte kullandığınız e-posta adresi gerekir." : "E-posta yalnızca 8 haneli sipariş kodunda gerekir; takip kodunda boş bırakabilirsiniz."}
      </p>
    </form>
  );
}
