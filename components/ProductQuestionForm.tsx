"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ProductQuestionForm({ productId, productTitle }: { productId: string; productTitle: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // Giriş yapmış müşterinin bilgilerini önceden doldur
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setName((n) => n || data.user.name);
          setEmail((e) => e || data.user.email);
        }
      })
      .catch(() => {});
  }, []);

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
      setMessage("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-serif font-bold text-neutral-900">Bu Ürün Hakkında Soru Sorun</h2>
        <p className="text-xs text-neutral-500 mt-0.5">Ekibimiz sorunuzu yanıtlar; yanıt e-postanıza gelir.</p>
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
              className="w-full p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600"
            />
            <input
              aria-label="E-posta adresiniz"
              required
              type="email"
              placeholder="E-posta adresiniz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600"
            />
          </div>
          <textarea
            aria-label="Sorunuz"
            required
            rows={3}
            placeholder="Sorunuzu yazın (ölçü, duy sayısı, montaj vb.)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600"
          />
          {error && (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="bg-neutral-900 hover:bg-amber-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? "Gönderiliyor..." : "Soruyu Gönder"}
          </button>
        </form>
      )}
    </section>
  );
}
