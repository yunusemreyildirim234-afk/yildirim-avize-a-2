import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import CookieBanner from "@/components/CookieBanner";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const inter = Inter({ subsets: ["latin"] });

const DESCRIPTION =
  "Beyoğlu Şişhane'den kristal, modern ve klasik avize modelleri. Üst düzey korumalı koliyle sigortalı kargo veya mağazadan teslim.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Yıldırım Avize | Beyoğlu Şişhane Kristal & Modern Avize",
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  icons: { icon: "/logo.png", shortcut: "/logo.png", apple: "/logo.png" },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: SITE_NAME,
    title: "Yıldırım Avize | Aydınlatmada Zarafet",
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/logo.png", width: 1512, height: 1512, alt: "Yıldırım Avize" }],
  },
  twitter: {
    card: "summary",
    title: "Yıldırım Avize",
    description: DESCRIPTION,
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        {/* Kayıtlı tema tercihini ilk boyamadan önce uygular (yanıp sönmeyi önler) */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("ya-theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}',
          }}
        />
      </head>
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <CartProvider>
          <WishlistProvider>
            <Navbar />
            {children}
            <Footer />
            <WhatsAppButton />
            <CookieBanner />
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
