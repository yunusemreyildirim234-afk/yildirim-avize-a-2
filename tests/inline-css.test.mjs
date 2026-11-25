import test from "node:test";
import assert from "node:assert/strict";
import config from "../next.config.ts";

// CSS HTML'e gömülür (render-blocking <link rel="stylesheet"> isteği kalkar). next.config.ts korunan dosyadır: diğer ayarlar burada sabitlenir.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.paytr.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.dsmcdn.com https://*.dsmcdn.com https://*.public.blob.vercel-storage.com https://images.unsplash.com https://lh3.googleusercontent.com https://www.google.com https://maps.gstatic.com https://*.googleapis.com",
  "font-src 'self' data:",
  "connect-src 'self' https://www.paytr.com",
  "frame-src https://www.paytr.com https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.paytr.com",
  "frame-ancestors 'self'",
  "report-uri /api/csp-report",
].join("; ");

test("inlineCss açık; experimental altında başka ayar yok", () => {
  assert.deepEqual(config.experimental, { inlineCss: true });
});

test("üst düzey ayarlar: yalnız experimental, headers, redirects, images", () => {
  assert.deepEqual(Object.keys(config).sort(), ["experimental", "headers", "images", "redirects"]);
});

test("güvenlik başlıkları değişmedi: CSP yalnız rapor modunda, gömülü <style> serbest", async () => {
  assert.deepEqual(await config.headers(), [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Content-Security-Policy-Report-Only", value: CSP },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()" },
      ],
    },
  ]);
});

test("yönlendirmeler ve görsel alan adları değişmedi", async () => {
  assert.deepEqual(await config.redirects(), [
    { source: "/hesabim/siparislerim", destination: "/giris#siparisler", permanent: false },
    { source: "/hesabim/mesajlarim", destination: "/giris#mesajlar", permanent: false },
    { source: "/hesabim/kuponlarim", destination: "/giris#kuponlar", permanent: false },
  ]);
  assert.deepEqual(config.images, {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.dsmcdn.com" },
      { protocol: "https", hostname: "**.dsmcdn.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  });
});
