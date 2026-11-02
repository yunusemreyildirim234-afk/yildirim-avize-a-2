import type { Metadata } from "next";
import CompanyInfo from "@/components/CompanyInfo";

export const metadata: Metadata = {
  title: "İletişim & Mağaza Yol Tarifi",
  description: "Beyoğlu Şişhane merkezimizin adresi, telefonu ve özel avize tasarım talep formu.",
  alternates: { canonical: "/iletisim" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div className="bg-neutral-50 px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-7xl mx-auto">
          <CompanyInfo variant="light" />
        </div>
      </div>
    </>
  );
}
