"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
interface Latest {
  status: Status;
  createdAt: string;
  adminNote: string | null;
}

/** Hesabım → Hesabı sil: silme talebi oluşturur; silme işlemini yönetici onaylar (açık siparişi olan hesap silinemez). */
export default function AccountDeletion() {
  const [latest, setLatest] = useState<Latest | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/user/account-deletion", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { request?: Latest | null }) => alive && setLatest(d.request ?? null))
      .catch(() => alive && setLatest(null));
    return () => {
      alive = false;
    };
  }, []);

  const send = async (method: "POST" | "DELETE") => {
    setBusy(true);
    try {
      const res = await fetch("/api/user/account-deletion", { method });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "İşlem şu anda yapılamadı.");
      setLatest(method === "POST" ? { status: "PENDING", createdAt: new Date().toISOString(), adminNote: null } : null);
      toast.success(method === "POST" ? "Hesap silme talebiniz alındı" : "Talebiniz geri çekildi");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setAsk(false);
    }
  };

  if (latest === undefined) return null;
  const pending = latest?.status === "PENDING";

  return (
    <section aria-labelledby="hesap-sil-baslik" className="bg-raised rounded-3xl border border-line p-6 sm:p-8 shadow-sm space-y-3">
      <h2 id="hesap-sil-baslik" className="text-lg font-serif font-bold text-ink">Hesabı Sil</h2>
      {pending ? (
        <>
          <p className="text-sm text-ink">Hesap silme talebiniz alındı ve inceleniyor. İşlem tamamlandığında e-posta ile bilgilendirileceksiniz.</p>
          <button type="button" disabled={busy} onClick={() => void send("DELETE")} className="inline-flex min-h-11 items-center rounded-lg border border-line-strong bg-raised px-4 text-xs font-semibold text-ink hover:border-bronze-ink disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink">
            Talebi geri çek
          </button>
        </>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-ink-muted">
            Hesabınızı silmek için talep oluşturabilirsiniz. Onaylanınca adresleriniz, favorileriniz, sepetiniz, yorumlarınız ve mesajlarınız silinir. Siparişleriniz ve faturalarınız yasal saklama süresince anonimleştirilmiş hesapla tutulur. Tamamlanmamış siparişiniz varsa silme işlemi bunlar kapandıktan sonra yapılabilir.
          </p>
          {latest?.status === "REJECTED" && (
            <p className="text-xs text-red-700">Önceki talebiniz karşılanamadı{latest.adminNote ? `: ${latest.adminNote}` : "."}</p>
          )}
          <button type="button" disabled={busy} onClick={() => setAsk(true)} className="inline-flex min-h-11 items-center rounded-lg border border-red-300 bg-raised px-4 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink">
            Hesabımı silmek istiyorum
          </button>
        </>
      )}
      <ConfirmDialog open={ask} title="Hesap silme talebi gönderilsin mi?" confirmLabel={busy ? "Gönderiliyor…" : "Talebi gönder"} danger confirmDisabled={busy} onConfirm={() => void send("POST")} onCancel={() => !busy && setAsk(false)}>
        <p>Talebiniz incelenir ve onaylanırsa hesabınız kalıcı olarak silinir; bu işlem geri alınamaz. Onaydan önce talebinizi istediğiniz zaman geri çekebilirsiniz.</p>
      </ConfirmDialog>
    </section>
  );
}
