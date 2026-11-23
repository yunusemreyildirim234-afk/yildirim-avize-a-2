// Ürün videosu adresi: saf doğrulama/normalleştirme (React/veritabanı yok; sunucu ve istemci aynı fonksiyonu kullanır, sunucu kararı esastır).
// Kabul: YouTube (watch?v=, youtu.be/, /shorts/, /embed/), Vimeo (vimeo.com/<sayı>, player.vimeo.com/video/<sayı>), doğrudan https .mp4 adresi.
// Saklanan değer `url` (kanonik biçim); gösterimde yalnız kimlikten üretilen `embedUrl` kullanılır, kullanıcı metni doğrudan iframe src'ine girmez.

export const VIDEO_URL_MAX = 500;
export const VIDEO_URL_ERROR = "Yalnız YouTube, Vimeo veya https ile başlayan .mp4 bağlantısı eklenebilir.";

export type VideoInfo =
  | { provider: "youtube"; id: string; url: string; embedUrl: string; thumbUrl: string }
  | { provider: "vimeo"; id: string; url: string; embedUrl: string }
  | { provider: "mp4"; url: string; src: string };

/** video: null = "video yok" (boş metin). */
export type VideoParse = { ok: true; video: VideoInfo | null } | { ok: false; error: string };

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID_RE = /^\d{1,12}$/;

const bad = (error: string): VideoParse => ({ ok: false, error });

function youtube(id: string): VideoParse {
  if (!YT_ID_RE.test(id)) return bad("YouTube bağlantısındaki video kimliği geçersiz.");
  return { ok: true, video: { provider: "youtube", id, url: `https://www.youtube.com/watch?v=${id}`, embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, thumbUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } };
}

function vimeo(id: string): VideoParse {
  if (!VIMEO_ID_RE.test(id)) return bad("Vimeo bağlantısındaki video kimliği geçersiz.");
  return { ok: true, video: { provider: "vimeo", id, url: `https://vimeo.com/${id}`, embedUrl: `https://player.vimeo.com/video/${id}` } };
}

export function parseVideoUrl(raw: unknown): VideoParse {
  if (raw === null || raw === undefined) return { ok: true, video: null };
  if (typeof raw !== "string") return bad("Video adresi metin olmalıdır.");
  if (/[\r\n]/.test(raw)) return bad("Video adresi tek satır olmalıdır.");
  const text = raw.trim();
  if (text === "") return { ok: true, video: null };
  if (text.length > VIDEO_URL_MAX) return bad(`Video adresi en fazla ${VIDEO_URL_MAX} karakter olabilir.`);
  if (/\s/.test(text)) return bad("Video adresi boşluk içeremez.");

  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return bad(VIDEO_URL_ERROR);
  }
  if (u.protocol !== "https:") return bad("Yalnız https ile başlayan adresler eklenebilir.");
  if (u.username || u.password || u.port) return bad(VIDEO_URL_ERROR);

  const host = u.hostname;
  const segs = u.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return segs.length === 1 ? youtube(segs[0]) : bad(VIDEO_URL_ERROR);
  if (YT_HOSTS.has(host)) {
    if (segs.length === 1 && segs[0] === "watch") return youtube(u.searchParams.get("v") ?? "");
    if (segs.length === 2 && (segs[0] === "shorts" || segs[0] === "embed")) return youtube(segs[1]);
    return bad(VIDEO_URL_ERROR);
  }
  if (VIMEO_HOSTS.has(host)) {
    if (host === "player.vimeo.com") return segs.length === 2 && segs[0] === "video" ? vimeo(segs[1]) : bad(VIDEO_URL_ERROR);
    return segs.length === 1 ? vimeo(segs[0]) : bad(VIDEO_URL_ERROR);
  }
  if (u.pathname.toLowerCase().endsWith(".mp4")) {
    u.hash = "";
    return { ok: true, video: { provider: "mp4", url: u.href, src: u.href } };
  }
  return bad(VIDEO_URL_ERROR);
}

/** Adres YouTube "shorts" biçimindeyse true (dikey 9:16 oynatıcı için). Kanonik kayıt shorts yolunu korumuyorsa false döner. */
export function isShortsUrl(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  try {
    const u = new URL(raw.trim());
    return YT_HOSTS.has(u.hostname) && u.pathname.split("/").filter(Boolean)[0] === "shorts";
  } catch {
    return false;
  }
}

/** Modal içinde oynatılacak iframe adresi (kullanıcı tıkladığı için autoplay). mp4 iframe değil <video> ile oynar: null. */
export function videoPlayerSrc(video: VideoInfo): string | null {
  if (video.provider === "youtube") return `${video.embedUrl}?autoplay=1&rel=0`;
  if (video.provider === "vimeo") return `${video.embedUrl}?autoplay=1`;
  return null;
}

/** Oynatıcı oranı: YouTube shorts dikey 9:16, diğer gömülü videolar 16:9, mp4 kendi oranında. */
export function videoAspect(video: VideoInfo, rawUrl?: unknown): "vertical" | "wide" | "native" {
  if (video.provider === "mp4") return "native";
  return video.provider === "youtube" && (isShortsUrl(rawUrl) || isShortsUrl(video.url)) ? "vertical" : "wide";
}
