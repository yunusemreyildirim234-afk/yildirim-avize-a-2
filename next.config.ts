import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
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
