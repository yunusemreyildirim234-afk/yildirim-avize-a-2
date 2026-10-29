import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "İletişim & Mağaza Yol Tarifi",
  description: "Beyoğlu Şişhane merkezimizin adresi, telefonu ve özel avize tasarım talep formu.",
  alternates: { canonical: "/iletisim" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
