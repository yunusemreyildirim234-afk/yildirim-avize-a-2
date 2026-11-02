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

/** Sepet formuna yazılan geçerli e-postayı bu tarayıcı oturumuyla ilişkilendirmek için saklar. */
export function rememberEmail(email: string) {
  try {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
  } catch {
    /* depolama kapalı olabilir */
  }
}

export function track(type: TrackType, detail: string, page?: string) {
  try {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        type,
        detail: detail.slice(0, 300),
        page: (page ?? window.location.pathname).slice(0, 120),
        sessionId: sessionId(),
        email: localStorage.getItem(EMAIL_KEY) ?? undefined,
      }),
    }).catch(() => {});
  } catch {
    /* izleme hiçbir zaman akışı bozmaz */
  }
}
