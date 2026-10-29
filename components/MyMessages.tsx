"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Message {
  id: string;
  kind: string;
  subject: string | null;
  message: string;
  status: string;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  product: { id: string; title: string } | null;
}

// Hesabım → Ürün Sorularım / Mesajlarım
export default function MyMessages() {
  const [messages, setMessages] = useState<Message[] | null>(null);

  useEffect(() => {
    fetch("/api/messages", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => setMessages([]));
  }, []);

  return (
    <div id="mesajlar" className="bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm space-y-6 scroll-mt-24">
      <h2 className="text-lg font-serif font-bold text-neutral-900 border-b border-neutral-100 pb-3">
        Ürün Sorularım / Mesajlarım
      </h2>

      {messages === null ? (
        <p className="text-center py-6 text-neutral-400 text-xs">Yükleniyor...</p>
      ) : messages.length === 0 ? (
        <p className="text-center py-6 text-neutral-400 text-xs">
          Henüz soru veya mesajınız yok. Ürün sayfalarından soru sorabilir ya da{" "}
          <Link href="/iletisim" className="underline">
            iletişim formunu
          </Link>{" "}
          kullanabilirsiniz.
        </p>
      ) : (
        <ul className="space-y-4">
          {messages.map((m) => {
            const answered = m.status === "ANSWERED";
            return (
              <li key={m.id} className="border border-neutral-200 rounded-2xl p-5 space-y-3 bg-neutral-50/50 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-neutral-500">
                    {m.product ? (
                      <Link href={`/urun/${m.product.id}`} className="font-semibold text-neutral-900 hover:text-amber-700">
                        {m.product.title}
                      </Link>
                    ) : (
                      <span className="font-semibold text-neutral-900">{m.subject || "İletişim mesajı"}</span>
                    )}
                    <span className="block text-[11px]">{new Date(m.createdAt).toLocaleString("tr-TR")}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      answered ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {answered ? "Yanıtlandı" : "Bekliyor"}
                  </span>
                </div>

                <p className="whitespace-pre-line text-neutral-800">{m.message}</p>

                {answered && m.reply && (
                  <div className="border-l-4 border-amber-500 bg-white rounded-r-xl p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      Yıldırım Avize yanıtı
                      {m.repliedAt && ` • ${new Date(m.repliedAt).toLocaleDateString("tr-TR")}`}
                    </span>
                    <p className="whitespace-pre-line text-neutral-800 mt-1">{m.reply}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
