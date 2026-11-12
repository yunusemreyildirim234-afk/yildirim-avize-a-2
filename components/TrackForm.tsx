"use client";

import { useEffect, useState } from "react";
import { isShortOrderCode } from "@/lib/order-lookup";

/** /kargo-takip formu. 8 haneli sipariş kodunda e-posta zorunlu olur; girişli kullanıcıda hesabından dolar. Sunucu eylemi değişmez. */
export default function TrackForm({ action, defaultCode }: { action: (formData: FormData) => void | Promise<void>; defaultCode?: string }) {
  const [code, setCode] = useState(defaultCode ?? "");
  const [email, setEmail] = useState("");
  const short = isShortOrderCode(code);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { user?: { email?: string } | null }) => {
        const mail = data.user?.email;
        if (mail) setEmail((cur) => cur || mail);
      })
      .catch(() => {});
  }, []);

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
          className="flex-1 border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white outline-none focus:border-amber-500"
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
          className="sm:w-64 border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white outline-none focus:border-amber-500"
        />
        <button type="submit" className="bg-neutral-900 hover:bg-amber-600 text-white text-xs font-semibold px-6 py-3 rounded-xl transition-colors">
          Sorgula
        </button>
      </div>
      <p id="email-ipucu" className="text-xs text-neutral-600">
        {short ? "8 haneli sipariş kodu için siparişte kullandığınız e-posta adresi gerekir." : "E-posta yalnızca 8 haneli sipariş kodunda gerekir; takip kodunda boş bırakabilirsiniz."}
      </p>
    </form>
  );
}
