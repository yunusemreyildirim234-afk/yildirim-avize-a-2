import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

// loading.tsx akışı 200 ile başlattığı için sayfanın içindeki notFound() HTTP durumunu değiştiremez;
// var olmayan sipariş burada, akıştan önce 404 olur.
export default async function OrderConfirmationLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exists = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!exists) notFound();
  return children;
}
