"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, Tag, Users } from "lucide-react";

export interface CouponRow {
  id: string;
  code: string;
  discountPercent: number;
  discountType: string; // PERCENT | FIXED
  discountAmount: number | null;
  minCartTotal: number | null;
  perUserLimit: number | null;
  maxUses: number;
  usedCount: number;
  userEmail: string | null;
  productTitle: string | null;
  productModelCode: string | null;
  active: boolean;
  createdAt: string;
}

interface Props {
  coupons: CouponRow[];
  customers: { name: string; email: string }[];
  products: { id: string; title: string; modelCode: string | null }[];
}

const norm = (v?: string | null) => (v ?? "").toLocaleLowerCase("tr").trim();

const tl = (n: number) => `${n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺`;

export default function AdminCoupons({ coupons, customers, products }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("10");
  const [dType, setDType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [minCart, setMinCart] = useState("");
  const [perUserOnce, setPerUserOnce] = useState(false);
  // Düzenleme paneli (kod değişmez; yalnızca yeni siparişleri etkiler)
  const [editId, setEditId] = useState<string | null>(null);
  const [eType, setEType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [eValue, setEValue] = useState("");
  const [eMin, setEMin] = useState("");
  const [eOnce, setEOnce] = useState(false);
  const [maxUses, setMaxUses] = useState("1");

  // Müşteri seçimi: "" = tüm müşteriler
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  // Ürün seçimi: "" = tüm ürünler
  const [productQuery, setProductQuery] = useState("");
  const [productId, setProductId] = useState("");

  const customerMatches = useMemo(() => {
    const q = norm(customerQuery);
    if (!q) return customers.slice(0, 8);
    return customers.filter((c) => norm(c.email).includes(q) || norm(c.name).includes(q)).slice(0, 8);
  }, [customers, customerQuery]);

  const productMatches = useMemo(() => {
    const q = norm(productQuery);
    if (!q) return [];
    return products.filter((p) => norm(p.title).includes(q) || norm(p.modelCode) === q).slice(0, 8);
  }, [products, productQuery]);

  const selectedProduct = products.find((p) => p.id === productId);

  const call = async (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "İşlem başarısız.");
        return false;
      }
      if (method === "POST" && data.emailSkipped) {
        alert("Kupon tanımlandı ve müşterinin hesabında bildirim olarak görünecek. Ancak bu müşterinin ticari elektronik ileti onayı bulunmamaktadır; bu nedenle kampanya e-postası gönderilmedi.");
      }
      router.refresh();
      return true;
    } catch {
      alert("Bağlantı hatası oluştu.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await call("POST", {
      code,
      discountType: dType,
      discountPercent: dType === "PERCENT" ? Number(percent) : undefined,
      discountAmount: dType === "FIXED" ? Number(percent) : undefined,
      minCartTotal: minCart === "" ? 0 : Number(minCart),
      perUserOnce,
      maxUses: Number(maxUses),
      userEmail: customerEmail,
      productId,
    });
    if (ok) {
      setCode("");
      setMinCart("");
      setPerUserOnce(false);
      setCustomerEmail("");
      setCustomerQuery("");
      setProductId("");
      setProductQuery("");
    }
  };

  const inputCls = "w-full p-2.5 rounded-lg border border-neutral-300 bg-white focus:outline-none focus:border-amber-600";

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full p-6 flex items-center justify-between gap-4 text-left hover:bg-neutral-50/60 transition-colors"
      >
        <div>
          <h2 className="text-lg font-serif font-bold text-neutral-900 flex items-center gap-2">
            <Tag aria-hidden="true" className="w-4 h-4 text-amber-600" /> Promosyon Kodları Yönetimi
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Kişiye veya ürüne özel, kullanım limitli indirim kodları oluşturun.
          </p>
        </div>
        <span className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-lg">
            {coupons.length} kod
          </span>
          <ChevronDown aria-hidden="true" className={`w-5 h-5 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="border-t border-neutral-100 p-6 space-y-6">
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-neutral-700 block mb-1">Promosyon Kodu</label>
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Örn: OMER10"
                className={`${inputCls} font-mono uppercase`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">İndirim Türü</label>
                <select value={dType} onChange={(e) => setDType(e.target.value as "PERCENT" | "FIXED")} className={inputCls}>
                  <option value="PERCENT">Yüzde (%)</option>
                  <option value="FIXED">TL tutar</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">{dType === "PERCENT" ? "İndirim (%)" : "İndirim (₺)"}</label>
                <input
                  required
                  type="number"
                  min={0.01}
                  max={dType === "PERCENT" ? 99.99 : 100000}
                  step="any"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Kullanım Limiti</label>
                <input required type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Minimum Sepet (₺)</label>
                <input type="number" min={0} step="any" value={minCart} onChange={(e) => setMinCart(e.target.value)} placeholder="Yok" className={inputCls} />
              </div>
              <label className="col-span-2 flex items-center gap-2 font-semibold text-neutral-700">
                <input type="checkbox" checked={perUserOnce} onChange={(e) => setPerUserOnce(e.target.checked)} className="accent-amber-600" />
                Kişi başı 1 kullanım
              </label>
            </div>

            {/* Müşteri */}
            <div>
              <label className="font-semibold text-neutral-700 block mb-1">Geçerli Müşteri</label>
              {customerEmail ? (
                <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                  <span className="font-semibold text-amber-950 break-all">{customerEmail}</span>
                  <button type="button" onClick={() => setCustomerEmail("")} className="text-red-600 font-semibold ml-3 shrink-0">
                    Kaldır
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 mb-2 text-emerald-900">
                    <Users aria-hidden="true" className="w-4 h-4 shrink-0" />
                    <span className="font-semibold">Herkes İçin (Genel Kupon)</span>
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wider">Seçili</span>
                  </div>
                  <div className="relative">
                    <Search aria-hidden="true" className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      aria-label="Müşteri ara"
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      placeholder="Veya kişiye özel yapmak için e-posta / ad yazın"
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                  {customerQuery && (
                    <ul className="mt-1 rounded-lg border border-neutral-200 divide-y divide-neutral-100 max-h-44 overflow-auto">
                      {customerMatches.length === 0 && <li className="px-3 py-2 text-neutral-400">Müşteri bulunamadı.</li>}
                      {customerMatches.map((c) => (
                        <li key={c.email}>
                          <button
                            type="button"
                            onClick={() => setCustomerEmail(c.email)}
                            className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                          >
                            <span className="font-semibold text-neutral-900">{c.email}</span>
                            <span className="block text-[10px] text-neutral-500">{c.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            {/* Ürün */}
            <div>
              <label className="font-semibold text-neutral-700 block mb-1">Geçerli Ürün</label>
              {selectedProduct ? (
                <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                  <span className="font-semibold text-amber-950">
                    {selectedProduct.modelCode ? `#${selectedProduct.modelCode} • ` : ""}
                    {selectedProduct.title}
                  </span>
                  <button type="button" onClick={() => setProductId("")} className="text-red-600 font-semibold ml-3 shrink-0">
                    Kaldır
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search aria-hidden="true" className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      aria-label="Ürün ara"
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                      placeholder="Tüm Ürünler (aramak için ürün adı veya model kodu yazın)"
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                  {productQuery && (
                    <ul className="mt-1 rounded-lg border border-neutral-200 divide-y divide-neutral-100 max-h-44 overflow-auto">
                      {productMatches.length === 0 && <li className="px-3 py-2 text-neutral-400">Ürün bulunamadı.</li>}
                      {productMatches.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => setProductId(p.id)}
                            className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                          >
                            <span className="font-mono text-amber-700 mr-2">#{p.modelCode ?? "-"}</span>
                            <span className="font-semibold text-neutral-900">{p.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="bg-neutral-900 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Promosyon Kodu Oluştur
              </button>
            </div>
          </form>

          <div className="overflow-x-auto border border-neutral-200 rounded-xl">
            <table className="w-full text-left text-xs text-neutral-700">
              <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wider text-[10px] border-b border-neutral-200">
                <tr>
                  <th className="p-3">Kod</th>
                  <th className="p-3">İndirim</th>
                  <th className="p-3">Kullanım</th>
                  <th className="p-3">Müşteri</th>
                  <th className="p-3">Ürün</th>
                  <th className="p-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {coupons.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-neutral-400">
                      Henüz promosyon kodu yok.
                    </td>
                  </tr>
                )}
                {coupons.map((c) => {
                  const remaining = Math.max(0, c.maxUses - c.usedCount);
                  return (
                    <Fragment key={c.id}>
                    <tr className={c.active ? "" : "opacity-50"}>
                      <td className="p-3 font-mono font-bold text-neutral-900">{c.code}</td>
                      <td className="p-3">
                        {c.discountType === "FIXED" && c.discountAmount ? tl(c.discountAmount) : `%${c.discountPercent}`}
                        {(c.minCartTotal || c.perUserLimit) && (
                          <span className="block text-[10px] text-neutral-500">
                            {[c.minCartTotal ? `Min. sepet ${tl(c.minCartTotal)}` : "", c.perUserLimit ? "Kişi başı 1" : ""].filter(Boolean).join(" • ")}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {c.usedCount} / {c.maxUses >= 1_000_000 ? "∞" : c.maxUses}
                        <span className="block text-[10px] text-neutral-500">
                          {c.maxUses >= 1_000_000 ? "Sınırsız" : `Kalan: ${remaining}`}
                        </span>
                      </td>
                      <td className="p-3 break-all">{c.userEmail ?? "Tüm müşteriler"}</td>
                      <td className="p-3">
                        {c.productTitle ? `#${c.productModelCode ?? "-"} ${c.productTitle}` : "Tüm ürünler"}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => call("PATCH", { id: c.id, active: !c.active })}
                          className="font-semibold text-amber-700 hover:underline mr-3"
                        >
                          {c.active ? "Pasife Al" : "Aktifleştir"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditId(editId === c.id ? null : c.id);
                            setEType(c.discountType === "FIXED" ? "FIXED" : "PERCENT");
                            setEValue(String(c.discountType === "FIXED" ? c.discountAmount ?? "" : c.discountPercent));
                            setEMin(c.minCartTotal ? String(c.minCartTotal) : "");
                            setEOnce(Boolean(c.perUserLimit));
                          }}
                          className="font-semibold text-amber-700 hover:underline mr-3"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => confirm(`"${c.code}" kodu silinsin mi?`) && call("DELETE", { id: c.id })}
                          className="font-semibold text-red-600 hover:underline"
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                    {editId === c.id && (
                      <tr className="bg-amber-50/40">
                        <td colSpan={6} className="p-3">
                          <form
                            className="flex flex-wrap items-end gap-3"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const ok = await call("PATCH", {
                                id: c.id,
                                discountType: eType,
                                discountPercent: eType === "PERCENT" ? Number(eValue) : undefined,
                                discountAmount: eType === "FIXED" ? Number(eValue) : undefined,
                                minCartTotal: eMin === "" ? 0 : Number(eMin),
                                perUserOnce: eOnce,
                              });
                              if (ok) setEditId(null);
                            }}
                          >
                            <div>
                              <label className="font-semibold text-neutral-700 block mb-1">Tür</label>
                              <select value={eType} onChange={(e) => setEType(e.target.value as "PERCENT" | "FIXED")} className={inputCls}>
                                <option value="PERCENT">Yüzde (%)</option>
                                <option value="FIXED">TL tutar</option>
                              </select>
                            </div>
                            <div>
                              <label className="font-semibold text-neutral-700 block mb-1">{eType === "PERCENT" ? "Yüzde" : "Tutar (₺)"}</label>
                              <input required type="number" min={0.01} max={eType === "PERCENT" ? 99.99 : 100000} step="any" value={eValue} onChange={(e) => setEValue(e.target.value)} className={inputCls} />
                            </div>
                            <div>
                              <label className="font-semibold text-neutral-700 block mb-1">Minimum Sepet (₺)</label>
                              <input type="number" min={0} step="any" value={eMin} onChange={(e) => setEMin(e.target.value)} placeholder="Yok" className={inputCls} />
                            </div>
                            <label className="flex items-center gap-2 font-semibold text-neutral-700 pb-2.5">
                              <input type="checkbox" checked={eOnce} onChange={(e) => setEOnce(e.target.checked)} className="accent-amber-600" />
                              Kişi başı 1 kullanım
                            </label>
                            <button type="submit" disabled={busy} className="bg-neutral-900 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors">
                              Kaydet
                            </button>
                            <p className="basis-full text-[10px] text-neutral-500">Kod değişmez. Mevcut siparişlerin tutarları değişmez; değişiklik yalnızca yeni siparişlerde geçerlidir.</p>
                          </form>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
