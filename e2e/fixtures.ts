import { test as base, expect, type BrowserContext, type Page, type Request } from "@playwright/test";

export { expect };

const GTM_HOST = /(^|\.)(googletagmanager\.com|google-analytics\.com|analytics\.google\.com)$/;
const IMAGE_CDN_HOST = /(^|\.)(dsmcdn\.com|trendyol\.com)$/;
// 1x1 saydam PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

/** Konsolda yok sayılan, test düzeneğinin kendi engellemelerinden gelen gürültü. */
// BULGU (siteye dokunulmaz): anonim ziyaretçide /api/favorites ve /api/cart 401 döner ve tarayıcı bunu konsola hata olarak yazar.
// Diğer testlerin gürültüsünü kesmek için burada yok sayılır; a-smoke.spec.ts içinde ayrı bir 'beklenen başarısız' testle raporlanır.
export const ANON_401 = /status of 401[\s\S]*\/api\/(favorites|cart|notifications|messages)\b/;
// e2e ortamında Kargonomi anahtarı boş (dış servis kapalı): il/ilçe uçları 502 döner; beklenen.
const KARGONOMI_OFF = /status of 502[\s\S]*\/api\/kargonomi\//;
const IGNORED_CONSOLE = [ANON_401, KARGONOMI_OFF, /net::ERR_BLOCKED_BY_CLIENT/i, /Failed to load resource: net::ERR_(FAILED|ABORTED)/i];

interface Fixtures {
  /** Sayfa açıkken oluşan tarayıcı konsolu hataları ve yakalanmamış istisnalar. */
  consoleErrors: string[];
  /** Sayfa açıkken 5xx dönen yanıtlar. */
  serverErrors: string[];
  /** GTM / GA alan adlarına denenen istekler (yanıt test tarafından boş betikle karşılanır; internete gitmez). */
  gtmRequests: Request[];
}

/**
 * Ağ kilidi: yalnızca baseURL kökeni geçer. GTM/GA ve Trendyol CDN görselleri internete GİTMEDEN yerel taslakla karşılanır; geri kalan her harici istek engellenir.
 * /api/events (istemci olay günlüğü) veritabanına yazdığı için taslaklanır: testler veritabanını değiştirmez.
 * Testin kendi açtığı ek bağlamlar (ör. misafir müşteri) da bunu çağırmalıdır.
 */
export async function lockNetwork(context: BrowserContext, baseURL: string) {
  const origin = new URL(baseURL).origin;
  await context.route("**/*", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === origin) {
      if (url.pathname === "/api/events") return route.fulfill({ status: 204, body: "" });
      return route.continue();
    }
    if (GTM_HOST.test(url.hostname)) return route.fulfill({ status: 200, contentType: "application/javascript", body: "/* e2e stub */" });
    if (IMAGE_CDN_HOST.test(url.hostname)) return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    return route.abort("blockedbyclient");
  });
}

export const test = base.extend<Fixtures>({
  context: async ({ context, baseURL }, use) => {
    await lockNetwork(context, baseURL!);
    await use(context);
  },
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = `${m.text()} @ ${m.location().url}`;
      if (!IGNORED_CONSOLE.some((re) => re.test(text))) errors.push(text);
    });
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    await use(errors);
  },
  serverErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("response", (r) => {
      if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
    });
    await use(errors);
  },
  gtmRequests: async ({ page }, use) => {
    const reqs: Request[] = [];
    page.on("request", (r) => {
      if (GTM_HOST.test(new URL(r.url()).hostname)) reqs.push(r);
    });
    await use(reqs);
  },
});

/** Sayfayı açar, 200 bekler. */
export async function openOk(page: Page, path: string) {
  const res = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(res, `${path} yanıt vermedi`).not.toBeNull();
  expect(res!.status(), `${path} durum kodu`).toBe(200);
  return res!;
}

/** Üst menüdeki kategori bağlantıları (mobil şerit DOM'da her ekranda var; görünürlüğe bağlı değil). */
export async function menuLinks(page: Page): Promise<{ href: string; label: string }[]> {
  return page.locator('nav[aria-label="Koleksiyonlar"] a').evaluateAll((els) => els.map((a) => ({ href: a.getAttribute("href") ?? "", label: (a.textContent ?? "").trim() })));
}

/** Listedeki ürün kartı bağlantıları. */
export const productLinks = (page: Page) => page.locator('a[href^="/urun/"]');

/** Ürün kartı/sayfası görsel adresi: /_next/image?url=... içindeki asıl adresi çözer. */
export function realImageUrl(src: string | null): string | null {
  if (!src) return null;
  try {
    const u = new URL(src, "http://x");
    return u.pathname === "/_next/image" ? decodeURIComponent(u.searchParams.get("url") ?? "") : src;
  } catch {
    return src;
  }
}

export const trNumber = (s: string): number => Number(s.replace(/[^\d,]/g, "").replace(",", "."));
