import type { NextConfig } from "next";

// Content-Security-Policy YALNIZCA rapor modunda: hiçbir şeyi engellemez, ihlaller /api/csp-report'a gider.
// Next.js satır içi başlatma betikleri, tema/JSON-LD betikleri ve Tailwind/stil öznitelikleri için 'unsafe-inline' gerekir.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.paytr.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://cdn.dsmcdn.com https://*.dsmcdn.com https://images.unsplash.com https://lh3.googleusercontent.com https://www.google.com https://maps.gstatic.com https://*.googleapis.com",
  "font-src 'self' data:",
  "connect-src 'self' https://www.paytr.com",
  "frame-src https://www.paytr.com https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://www.paytr.com",
  "frame-ancestors 'self'",
  "report-uri /api/csp-report",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // PayTR iframe (frame embed) ve Google OAuth (yönlendirme) etkilenmez; yalnızca hassas donanım API'leri kapatılır
          { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/hesabim/siparislerim", destination: "/giris#siparisler", permanent: false },
      { source: "/hesabim/mesajlarim", destination: "/giris#mesajlar", permanent: false },
      { source: "/hesabim/kuponlarim", destination: "/giris#kuponlar", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.dsmcdn.com" },
      { protocol: "https", hostname: "**.dsmcdn.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
