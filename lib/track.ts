// İstemci tarafı hafif olay izleme. Hata verirse sessizce yutulur; hiçbir akışı bloklamaz.
export type TrackType = "SEARCH" | "CART_ADD" | "CHECKOUT_START" | "ERROR";

const SID_KEY = "ya_sid";
const EMAIL_KEY = "ya_email";

function sessionId(): string {
  let sid = localStorage.getItem(SID_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(SID_KEY, sid);
  }
  return sid;
}

/**
 * Eski sürümler formdaki e-postayı localStorage'da (ya_email) saklıyordu; çıkıştan sonra da kalıp misafir etkinliklerini
 * eski üyenin altında gösteriyordu. Artık e-posta saklanmaz/gönderilmez (kimliği sunucu ya_user çerezinden belirler);
 * bu fonksiyon yalnızca eski değeri temizler.
 */
export function rememberEmail(_email?: string) {
  void _email;
  try {
    localStorage.removeItem(EMAIL_KEY);
  } catch {
    /* depolama kapalı olabilir */
  }
}

export function track(type: TrackType, detail: string, page?: string) {
  try {
    localStorage.removeItem(EMAIL_KEY); // eski sürümden kalan değeri temizle
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        type,
        detail: detail.slice(0, 300),
        page: (page ?? window.location.pathname).slice(0, 120),
        sessionId: sessionId(),
      }),
    }).catch(() => {});
  } catch {
    /* izleme hiçbir zaman akışı bozmaz */
  }
}
