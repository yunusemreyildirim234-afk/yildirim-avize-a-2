"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { UserX } from "lucide-react";
import AdminSection from "@/components/AdminSection";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Req {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
  name: string;
  email: string | null;
  registeredAt: string;
  lastLoginAt: string | null;
  orderCount: number | null;
  openOrderCount: number | null;
}

const STATUS: Record<Req["status"], string> = { PENDING: "Bekliyor", APPROVED: "Silindi", REJECTED: "Reddedildi", CANCELLED: "Müşteri vazgeçti" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }) : "—");

/** Yönetici: hesap silme talepleri. Onay kişisel verileri siler ve hesabı anonimleştirir (siparişler yasal saklama için kalır). */
export default function AdminAccountDeletions() {
  const [items, setItems] = useState<Req[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<{ req: Req; action: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/account-deletions", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setItems(((await res.json()) as { requests: Req[] }).requests);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/account-deletions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: target.req.id, action: target.action, adminNote: note }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "İşlem başarısız.");
      toast.success(target.action === "approve" ? "Hesap silindi ve anonimleştirildi." : "Talep reddedildi.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setTarget(null);
      setNote("");
      void load();
    }
  };

  const pending = items?.filter((r) => r.status === "PENDING").length ?? 0;
  const open = (req: Req, action: "approve" | "reject") => {
    setNote("");
    setTarget({ req, action });
  };

  return (
    <AdminSection
      id="hesap-silme"
      icon={<UserX aria-hidden="true" className="w-4 h-4 text-amber-600" />}
      title="Hesap Silme Talepleri"
      description="Müşterinin Hesabım'dan gönderdiği silme talepleri. Onayda kişisel veriler silinir; siparişler ve faturalar yasal saklama için anonim hesapla kalır."
      badges={[{ label: `${pending} bekleyen`, tone: pending > 0 ? "amber" : "neutral" }]}
    >
      <div className="p-6">
        {failed && (
          <p className="text-sm text-red-700">
            Talepler yüklenemedi.{" "}
            <button type="button" onClick={() => void load()} className="underline font-semibold">
              Yeniden dene
            </button>
          </p>
        )}
        {!failed && items === null && <p className="text-sm text-neutral-500">Yükleniyor…</p>}
        {items?.length === 0 && <p className="text-sm text-neutral-500">Henüz hesap silme talebi yok.</p>}
        <ul className="space-y-3">
          {items?.map((r) => (
            <li key={r.id} className="rounded-xl border border-neutral-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-neutral-900 break-words">
                    {r.name}
                    {r.email ? <span className="font-normal text-neutral-600"> · {r.email}</span> : null}
                  </p>
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-neutral-600">
                    <dt>Talep</dt>
                    <dd>{fmt(r.createdAt)}</dd>
                    <dt>Üyelik</dt>
                    <dd>{fmt(r.registeredAt)}</dd>
                    <dt>Son giriş</dt>
                    <dd>{fmt(r.lastLoginAt)}</dd>
                    {r.processedAt && (
                      <>
                        <dt>İşlem</dt>
                        <dd>{fmt(r.processedAt)}</dd>
                      </>
                    )}
                    {r.orderCount !== null && (
                      <>
                        <dt>Sipariş</dt>
                        <dd>
                          {r.orderCount} (açık: {r.openOrderCount})
                        </dd>
                      </>
                    )}
                    {r.adminNote && (
                      <>
                        <dt>Not</dt>
                        <dd className="break-words">{r.adminNote}</dd>
                      </>
                    )}
                  </dl>
                </div>
                <span className={`text-xs font-semibold border px-3 py-1.5 rounded-lg ${r.status === "PENDING" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>{STATUS[r.status]}</span>
              </div>
              {r.status === "PENDING" && (
                <div className="mt-3 space-y-2">
                  {(r.openOrderCount ?? 0) > 0 && <p className="text-xs text-red-700">Açık siparişi var: bunlar kapanmadan onay verilemez.</p>}
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={(r.openOrderCount ?? 0) > 0}
                      onClick={() => open(r, "approve")}
                      className="inline-flex min-h-10 items-center rounded-lg bg-red-700 px-4 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
                    >
                      Onayla ve sil
                    </button>
                    <button
                      type="button"
                      onClick={() => open(r, "reject")}
                      className="inline-flex min-h-10 items-center rounded-lg border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-800 hover:border-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
                    >
                      Reddet
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <ConfirmDialog
        open={target !== null}
        title={target?.action === "approve" ? "Hesap kalıcı olarak silinsin mi?" : "Talep reddedilsin mi?"}
        confirmLabel={busy ? "İşleniyor…" : target?.action === "approve" ? "Evet, sil" : "Reddet"}
        danger={target?.action === "approve"}
        confirmDisabled={busy}
        onConfirm={() => void run()}
        onCancel={() => !busy && setTarget(null)}
      >
        {target?.action === "approve" ? (
          <p>
            <strong>{target.req.name}</strong> hesabının adres, favori, sepet, yorum, mesaj ve bildirimleri silinecek; hesap anonimleştirilecek ve e-posta bildirimleri kapatılacak. Siparişler korunur. Bu işlem geri alınamaz.
          </p>
        ) : (
          <p>
            <strong>{target?.req.name}</strong> için silme talebi reddedilecek; hesap olduğu gibi kalır.
          </p>
        )}
        <label className="block">
          <span className="text-xs font-semibold text-neutral-700">Not (isteğe bağlı{target?.action === "reject" ? ", müşteriye bildirimde gösterilir" : ""})</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-xs focus-visible:outline-2 focus-visible:outline-amber-600" />
        </label>
      </ConfirmDialog>
    </AdminSection>
  );
}
