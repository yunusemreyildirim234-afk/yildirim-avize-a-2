"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface AdminMessage {
  id: string;
  kind: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: string;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  productTitle: string | null;
}

export default function AdminMessages({ messages }: { messages: AdminMessage[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Record<string, string>>({});

  const pending = messages.filter((m) => m.status === "PENDING").length;

  const send = async (m: AdminMessage) => {
    const reply = (drafts[m.id] ?? m.reply ?? "").trim();
    if (!reply) return;
    setSendingId(m.id);
    try {
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, reply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yanıt gönderilemedi.");
      setNotice((n) => ({
        ...n,
        [m.id]: data.emailed ? "✓ Yanıt kaydedildi ve müşteriye e-posta ile gönderildi." : "Yanıt kaydedildi ancak e-posta gönderilemedi (Resend ayarlarını kontrol edin).",
      }));
      router.refresh();
    } catch (err) {
      setNotice((n) => ({ ...n, [m.id]: (err as Error).message }));
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div id="mesajlar" className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      <div className="p-6 border-b border-neutral-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-serif font-bold text-neutral-900">Gelen Mesajlar & Sorular</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            İletişim formu mesajları ve ürün soruları. Yanıtınız müşteriye e-posta ile iletilir ve hesabında görünür.
          </p>
        </div>
        <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg shrink-0">
          {pending} bekleyen
        </span>
      </div>

      {messages.length === 0 ? (
        <div className="p-12 text-center text-neutral-400 text-xs">Henüz gelen mesaj veya soru yok.</div>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {messages.map((m) => {
            const answered = m.status === "ANSWERED";
            return (
              <li key={m.id} className="p-5 space-y-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      m.kind === "PRODUCT_QUESTION" ? "bg-blue-100 text-blue-800" : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {m.kind === "PRODUCT_QUESTION" ? "Ürün Sorusu" : "İletişim"}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      answered ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {answered ? "Yanıtlandı" : "Bekliyor"}
                  </span>
                  <span className="text-neutral-400">{new Date(m.createdAt).toLocaleString("tr-TR")}</span>
                </div>

                <div>
                  <strong className="text-neutral-900">{m.name}</strong>{" "}
                  <a href={`mailto:${m.email}`} className="text-amber-700 hover:underline">
                    {m.email}
                  </a>
                  {m.phone && <span className="text-neutral-500 font-mono"> • {m.phone}</span>}
                  {m.productTitle && <div className="text-neutral-500 mt-0.5">Ürün: {m.productTitle}</div>}
                  {m.subject && <div className="text-neutral-500 mt-0.5">Konu: {m.subject}</div>}
                </div>

                <p className="whitespace-pre-line text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-xl p-3">{m.message}</p>

                <div className="space-y-2">
                  <label htmlFor={`reply-${m.id}`} className="font-semibold text-neutral-700 block">
                    {answered ? "Yanıtınız (düzenleyip yeniden gönderebilirsiniz)" : "Yanıt yazın"}
                  </label>
                  <textarea
                    id={`reply-${m.id}`}
                    rows={3}
                    value={drafts[m.id] ?? m.reply ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                    className="w-full p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-amber-600"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={sendingId === m.id || !(drafts[m.id] ?? m.reply ?? "").trim()}
                      onClick={() => send(m)}
                      className="bg-neutral-900 hover:bg-amber-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {sendingId === m.id ? "Gönderiliyor..." : answered ? "Yanıtı Güncelle & Gönder" : "Yanıtla & E-posta Gönder"}
                    </button>
                    {answered && m.repliedAt && !notice[m.id] && (
                      <span className="text-neutral-400">Son yanıt: {new Date(m.repliedAt).toLocaleString("tr-TR")}</span>
                    )}
                    {notice[m.id] && <span className="text-neutral-600">{notice[m.id]}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
