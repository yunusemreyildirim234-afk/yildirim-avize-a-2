import { notFound } from "next/navigation";
import { getConfirmationOrder } from "@/lib/order-confirmation";

// loading.tsx akışı 200 ile başlattığı için sayfanın içindeki notFound() HTTP durumunu değiştiremez;
// var olmayan sipariş burada, akıştan önce 404 olur. Okuma sayfayla paylaşılır (React cache): ikinci sorgu yok.
export default async function OrderConfirmationLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exists = await getConfirmationOrder(id);
  if (!exists) notFound();
  return children;
}
