// Geç gelen PayTR "success" bildirimi için kayıt + yönetici uyarısı (panel bildirimi + e-posta). Saf yardımcı: dış bağımlılıklar parametre olarak verilir (test edilebilir).

/** Ödemesi sorunsuz işlenmiş siparişte tekrar gelen "success" zararsız yinelemedir (PayTR aynı bildirimi tekrarlayabilir): yalnızca uyarı logu. */
const BENIGN_DUPLICATE = ["PENDING", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED"];

/** Yönetici e-postası en fazla bu kadar beklenir; callback hızlı "OK" dönmeli (Resend yavaş/asılı kalabilir). */
const EMAIL_TIMEOUT_MS = 4000;

export interface LateOrderInfo {
  totalAmount: number;
  customerName: string | null;
  phone: string | null;
}

export interface LatePaymentDeps {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  notifyAdmins: (p: { title: string; message: string; type: "ORDER"; link: string }) => Promise<unknown>;
  /** Yönetici e-postası gönderici (verilmezse lib/email.ts Resend yardımcısı kullanılır). */
  emailAdmin?: (m: { subject: string; html: string }) => Promise<unknown>;
  /** Sipariş özeti okuyucu (verilmezse prisma ile okunur). */
  loadOrder?: (orderId: string) => Promise<LateOrderInfo | null>;
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Yönetici e-postasının konu + gövdesi (saf fonksiyon). */
export function buildLatePaymentEmail(d: { orderId: string; orderStatus: string; merchantOid: string; siteUrl: string; order: LateOrderInfo | null }): { subject: string; html: string } {
  const tutar = d.order ? `${d.order.totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺` : "okunamadı";
  const ad = d.order?.customerName?.trim() || "okunamadı";
  const tel = d.order?.phone?.trim() || "okunamadı";
  return {
    subject: `Ödeme alındı ama sipariş iptal/başarısız: #${d.orderId.slice(0, 8)}`,
    html: `<p>PayTR başarılı ödeme bildirdi, ancak sipariş artık ödeme beklemiyor. Müşteriden para çekilmiş olabilir.</p>
      <p>Sipariş no: <code>${esc(d.orderId)}</code><br />PayTR işlem no: <code>${esc(d.merchantOid)}</code><br />Mevcut durum: <strong>${esc(d.orderStatus)}</strong><br />Tutar: <strong>${esc(tutar)}</strong><br />Müşteri: ${esc(ad)}<br />Telefon: ${esc(tel)}</p>
      <p>Ne yapmalı: PayTR panelinden iade edin veya stok varsa siparişi elle işleme alın.</p>
      <p><a href="${esc(d.siteUrl)}/admin#siparisler">Yönetim panelinde siparişleri aç</a></p>`,
  };
}

async function defaultLoadOrder(orderId: string): Promise<LateOrderInfo | null> {
  const { prisma } = await import("@/lib/db");
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { totalAmount: true, phone: true, user: { select: { name: true } } } });
  return o ? { totalAmount: o.totalAmount, customerName: o.user?.name ?? null, phone: o.phone } : null;
}

async function defaultEmailAdmin(m: { subject: string; html: string }): Promise<unknown> {
  const { sendLatePaymentAdminEmail } = await import("@/lib/email");
  return sendLatePaymentAdminEmail(m);
}

/**
 * Sipariş AWAITING_PAYMENT/PENDING_NEW değilken gelen "success" bildirimini kaydeder. Durumu DEĞİŞTİRMEZ, stok/kupon/fiyat işlemi yapmaz.
 * Para alındığı hâlde sipariş iptal/başarısız/iade durumundaysa yöneticiye panel bildirimi (önce) + e-posta (zaman aşımlı) gider;
 * yinelenen bildirimler yalnızca loglanır. Her kanalın hatası yutulur (callback yine 200 OK döner). En az bir kanal başarılıysa true.
 */
export async function reportLatePayment(
  deps: LatePaymentDeps,
  info: { merchantOid: string; orderId: string; orderStatus: string; payStatus: string; siteUrl?: string }
): Promise<boolean> {
  if (info.payStatus !== "success") return false;
  if (BENIGN_DUPLICATE.includes(info.orderStatus)) {
    deps.warn("[paytr] yinelenen success bildirimi (işlem yapılmadı)", { merchant_oid: info.merchantOid, durum: info.orderStatus, status: info.payStatus });
    return false;
  }
  deps.log("[paytr] GEÇ SUCCESS: ödeme alınmış ama sipariş uygun durumda değil", { merchant_oid: info.merchantOid, durum: info.orderStatus, status: info.payStatus });
  let panelOk = false;
  try {
    await deps.notifyAdmins({
      title: `Ödeme alındı ama sipariş #${info.orderId.slice(0, 8)} durumu ${info.orderStatus}`,
      message: `PayTR başarılı ödeme bildirdi (${info.merchantOid}); sipariş durumu ${info.orderStatus}. Siparişi kontrol edin; gerekirse müşteriye iade/iletişim yapın.`,
      type: "ORDER",
      link: "/admin#siparisler",
    });
    panelOk = true;
  } catch (e) {
    deps.log("[paytr] geç success bildirimi gönderilemedi:", (e as Error)?.message);
  }
  let emailOk = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const work = (async () => {
      const order = await (deps.loadOrder ?? defaultLoadOrder)(info.orderId).catch(() => null);
      const siteUrl = info.siteUrl ?? (await import("@/lib/site")).SITE_URL;
      const mail = buildLatePaymentEmail({ orderId: info.orderId, orderStatus: info.orderStatus, merchantOid: info.merchantOid, siteUrl, order });
      return (await (deps.emailAdmin ?? defaultEmailAdmin)(mail)) !== false;
    })();
    work.catch(() => {}); // zaman aşımından sonra geç gelen hata işlenmemiş reddedilme olmasın
    emailOk = await Promise.race([work, new Promise<boolean>((_, rej) => { timer = setTimeout(() => rej(new Error("zaman aşımı")), EMAIL_TIMEOUT_MS); })]);
  } catch (e) {
    deps.log("[paytr] geç success e-postası gönderilemedi:", (e as Error)?.message);
  } finally {
    if (timer) clearTimeout(timer);
  }
  return panelOk || emailOk;
}
