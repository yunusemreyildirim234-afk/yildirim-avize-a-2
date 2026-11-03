// Geç gelen PayTR "success" bildirimi için kayıt + yönetici uyarısı. Saf yardımcı: dış bağımlılıklar parametre olarak verilir (test edilebilir).

/** Ödemesi sorunsuz işlenmiş siparişte tekrar gelen "success" zararsız yinelemedir (PayTR aynı bildirimi tekrarlayabilir): yalnızca uyarı logu. */
const BENIGN_DUPLICATE = ["PENDING", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED"];

export interface LatePaymentDeps {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  notifyAdmins: (p: { title: string; message: string; type: "ORDER"; link: string }) => Promise<unknown>;
}

/**
 * Sipariş AWAITING_PAYMENT/PENDING_NEW değilken gelen "success" bildirimini kaydeder. Durumu DEĞİŞTİRMEZ, stok/kupon/fiyat işlemi yapmaz.
 * Para alındığı hâlde sipariş iptal/başarısız/iade durumundaysa yöneticiye bildirim gider; yinelenen bildirimler yalnızca loglanır.
 * Bildirim hatası yutulur (callback yine 200 OK döner). Bildirim gönderildiyse true.
 */
export async function reportLatePayment(
  deps: LatePaymentDeps,
  info: { merchantOid: string; orderId: string; orderStatus: string; payStatus: string }
): Promise<boolean> {
  if (info.payStatus !== "success") return false;
  if (BENIGN_DUPLICATE.includes(info.orderStatus)) {
    deps.warn("[paytr] yinelenen success bildirimi (işlem yapılmadı)", { merchant_oid: info.merchantOid, durum: info.orderStatus, status: info.payStatus });
    return false;
  }
  deps.log("[paytr] GEÇ SUCCESS: ödeme alınmış ama sipariş uygun durumda değil", { merchant_oid: info.merchantOid, durum: info.orderStatus, status: info.payStatus });
  try {
    await deps.notifyAdmins({
      title: `Ödeme alındı ama sipariş #${info.orderId.slice(0, 8)} durumu ${info.orderStatus}`,
      message: `PayTR başarılı ödeme bildirdi (${info.merchantOid}); sipariş durumu ${info.orderStatus}. Siparişi kontrol edin; gerekirse müşteriye iade/iletişim yapın.`,
      type: "ORDER",
      link: "/admin#siparisler",
    });
    return true;
  } catch (e) {
    deps.log("[paytr] geç success bildirimi gönderilemedi:", (e as Error)?.message);
    return false;
  }
}
