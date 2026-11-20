"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { toast } from "sonner";

export default function ProductQuestionForm({ productId, productTitle }: { productId: string; productTitle: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // Giriş yapmış müşterinin bilgilerini önceden doldur
  const { user: account } = useAuth();
  useEffect(() => {
    if (account) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- oturum bilgisi geldikten sonra boş alanlar doldurulur
      setName((n) => n || account.name);
      setEmail((e) => e || account.email);
    }
  }, [account]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, productId, subject: `Ürün sorusu: ${productTitle}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Soru gönderilemedi.");
      setDone(true);
      toast.success("Sorunuz iletildi", { description: "Yanıt e-posta adresinize gönderilecek." });
      setMessage("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-raised rounded-3xl border border-line p-6 sm:p-8 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-serif font-bold text-ink">Bu Ürün Hakkında Soru Sorun</h2>
        <p className="text-xs text-ink-muted mt-0.5">Ekibimiz sorunuzu yanıtlar; yanıt e-postanıza gelir.</p>
      </div>

      {done ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 space-y-1">
          <p className="font-semibold">✓ Sorunuz iletildi.</p>
          <p>
            Giriş yaptıysanız yanıtı{" "}
            <Link href="/giris#mesajlar" className="underline font-semibold">
              Hesabım → Ürün Sorularım / Mesajlarım
            </Link>{" "}
            bölümünde de görebilirsiniz.
          </p>
          <button type="button" onClick={() => setDone(false)} className="underline font-semibold pt-1">
            Yeni soru sor
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              aria-label="Adınız Soyadınız"
              required
              placeholder="Adınız Soyadınız"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded-xl border border-line-strong focus:border-bronze-ink focus-visible:outline-2 focus-visible:outline-bronze-ink"
            />
            <input
              aria-label="E-posta adresiniz"
              required
              type="email"
              placeholder="E-posta adresiniz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl border border-line-strong focus:border-bronze-ink focus-visible:outline-2 focus-visible:outline-bronze-ink"
            />
          </div>
          <textarea
            aria-label="Sorunuz"
            required
            rows={3}
            placeholder="Sorunuzu yazın (ölçü, duy sayısı, montaj vb.)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-3 rounded-xl border border-line-strong focus:border-bronze-ink focus-visible:outline-2 focus-visible:outline-bronze-ink"
          />
          {error && (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="bg-ink hover:bg-bronze-ink text-canvas font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? "Gönderiliyor..." : "Soruyu Gönder"}
          </button>
          <p className="text-[11px] text-ink-muted">
            Kişisel verileriniz{" "}
            <Link href="/aydinlatma-metni" className="font-semibold text-bronze-ink underline underline-offset-2">aydınlatma metni</Link>{" "}
            kapsamında işlenir.
          </p>
        </form>
      )}
    </section>
  );
}
