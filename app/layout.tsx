import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import CookieBanner from "@/components/CookieBanner";
import GoogleTagManager from "@/components/GoogleTagManager";
import ToastLinkRouter from "@/components/ToastLinkRouter";
import SkipLink from "@/components/SkipLink";
import HideOnAdmin from "@/components/HideOnAdmin";
import AdminTopBar from "@/components/AdminTopBar";
import { getGalleryPhotoCount } from "@/lib/customer-gallery";
import { getExtraCategoryLinks, getFixedCategoryOverrides } from "@/lib/category-list";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { AuthProvider } from "@/context/AuthContext";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Türkçe karakterler (ğ, ş, ı, İ) latin-ext alt kümesindedir; yoksa sistem yazı tipine düşer
const inter = Inter({ subsets: ["latin", "latin-ext"] });

const DESCRIPTION =
  "Beyoğlu Şişhane'den kristal, modern ve klasik avize modelleri. Üst düzey korumalı koliyle kargo veya mağazadan teslim.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Yıldırım Avize | Beyoğlu Şişhane Kristal & Modern Avize",
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-v2.ico", sizes: "any" },
      { url: "/icon-192-v3.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512-v3.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon-v2.ico",
    apple: [{ url: "/apple-touch-icon-v3.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
  other: { "mobile-web-app-capable": "yes" },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: SITE_NAME,
    title: "Yıldırım Avize | Aydınlatmada Zarafet",
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/og-v2.png", width: 1200, height: 630, alt: "Yıldırım Avize" }],
  },
  twitter: {
    card: "summary",
    title: "Yıldırım Avize",
    description: DESCRIPTION,
    images: ["/logo-kare-yazili-v3.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#d97706",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Yönetim panelinden eklenen koleksiyonlar (60 sn önbellek; hata olursa sabit menü)
  const [extraCategories, fixedOverrides, galleryCount] = await Promise.all([getExtraCategoryLinks(), getFixedCategoryOverrides(), getGalleryPhotoCount()]);
  const showGallery = galleryCount > 0; // yayınlanmış müşteri fotoğrafı yokken bağlantı gizli
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
        <SkipLink />
        <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            {/* Yönetim panelinde mağaza menüsü ve alt bilgi yerine sade admin üst çubuğu */}
            <HideOnAdmin fallback={<AdminTopBar />}>
              <Navbar extraCategories={extraCategories} fixedOverrides={fixedOverrides} showGallery={showGallery} />
            </HideOnAdmin>
            {children}
            <HideOnAdmin>
              <Footer extraCategories={extraCategories} fixedOverrides={fixedOverrides} showGallery={showGallery} />
            </HideOnAdmin>
            <WhatsAppButton />
            <CookieBanner />
            <GoogleTagManager />
            <Toaster position="top-right" richColors closeButton />
            <ToastLinkRouter />
          </WishlistProvider>
        </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
