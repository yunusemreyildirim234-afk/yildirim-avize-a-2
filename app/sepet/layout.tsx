import type { Metadata } from "next";
// Sepet sayfası client bileşeni; ProductCard'ı yalnızca app/cart-more.tsx sunucu eylemi render eder. Kartın client bileşenleri
// (ProductQuickActions, CardImages) bu rotanın client reference manifest'ine girsin diye modül grafiğine yan etkili import ile sokulur.
import "@/components/ProductCard";

export const metadata: Metadata = {
  title: "Sepetim",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
