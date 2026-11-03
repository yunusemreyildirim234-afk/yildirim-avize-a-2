import { rateLimit } from "@/lib/rate-limit";

const MAX_BODY = 8 * 1024;
const noContent = () => new Response(null, { status: 204 });

/** URL'den sorgu ve parçayı atar, kısaltır (kişisel veri/parametre loglanmaz). Şema olmayan değerler ("inline", "eval") olduğu gibi kalır. */
function cleanUrl(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.slice(0, 300).split(/[?#]/)[0];
  return s.slice(0, 120);
}
const cleanText = (v: unknown) => (typeof v === "string" ? v.slice(0, 80) : "");

// CSP ihlal raporları (yalnızca Report-Only). Veritabanına yazılmaz; her durumda 204 döner, hata vermez.
export async function POST(req: Request) {
  if (rateLimit(req, "csp-report", 30, 60_000).limited) return noContent();
  try {
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_BODY) return noContent();
    const text = await req.text();
    if (text.length > MAX_BODY) return noContent();
    const parsed: unknown = JSON.parse(text);
    // Eski biçim {"csp-report": {...}} veya Reporting API [{type, body}]
    const first: unknown = Array.isArray(parsed) ? parsed[0] : parsed;
    const raw = first && typeof first === "object" ? ((first as Record<string, unknown>)["csp-report"] ?? (first as Record<string, unknown>).body ?? first) : null;
    if (!raw || typeof raw !== "object") return noContent();
    const r = raw as Record<string, unknown>;
    console.warn(
      "[csp-report]",
      JSON.stringify({
        directive: cleanText(r["violated-directive"] ?? r.effectiveDirective ?? r["effective-directive"]),
        blocked: cleanUrl(r["blocked-uri"] ?? r.blockedURL),
        document: cleanUrl(r["document-uri"] ?? r.documentURL),
      })
    );
  } catch {
    // bozuk gövde: sessizce yoksay
  }
  return noContent();
}
