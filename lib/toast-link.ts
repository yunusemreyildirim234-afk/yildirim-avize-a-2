// Tıklanabilir toast ve bildirim bağlantıları için saf yardımcılar (test edilebilir).
// sonner toast'ı `testId` seçeneğiyle `data-testid="href:/yol"` taşır; components/ToastLinkRouter bunu okuyup yönlendirir.

const PREFIX = "href:";

/** Toast seçeneklerine eklenecek: toast("...", { ...toastHref("/sepet") }). */
export const toastHref = (href: string) => ({ testId: PREFIX + href });

/** Yalnızca site içi mutlak yol kabul edilir ("/x", "/x#y"); "//dis", "http://..." reddedilir. */
export function isInternalLink(link: string | null | undefined): link is string {
  return typeof link === "string" && link.startsWith("/") && !link.startsWith("//") && !/[\s\\]/.test(link);
}

/** data-testid değerinden hedef yol; toast bağlantı taşımıyorsa null. */
export function hrefFromTestId(v: string | null | undefined): string | null {
  if (!v || !v.startsWith(PREFIX)) return null;
  const href = v.slice(PREFIX.length);
  return isInternalLink(href) ? href : null;
}

export type LinkAction = { kind: "none" } | { kind: "navigate"; href: string } | { kind: "hash"; hash: string };

/**
 * Bağlantıya tıklanınca ne yapılmalı?
 * - Geçersiz/dış bağlantı: hiçbir şey.
 * - Zaten o sayfadaysan ve hash yoksa: hiçbir şey (boşa yönlendirme yok).
 * - Aynı sayfada yalnızca hash (ör. /admin#siparisler): hash kind (bölüm açılsın/kaydırılsın).
 * - Aksi: navigate.
 */
export function resolveLinkAction(currentPath: string, link: string | null | undefined): LinkAction {
  if (!isInternalLink(link)) return { kind: "none" };
  const [path, ...rest] = link.split("#");
  const hash = rest.join("#");
  const samePage = path.split("?")[0] === currentPath && !path.includes("?");
  if (samePage) return hash ? { kind: "hash", hash } : { kind: "none" };
  return { kind: "navigate", href: link };
}
