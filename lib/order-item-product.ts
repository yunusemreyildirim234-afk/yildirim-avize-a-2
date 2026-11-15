import { productPath } from "@/lib/product-url";

// Admin sipariş listesinde kalemin ürün adı/fotoğrafı/bağlantısı. Ürün silinmiş olsa da çökmez.
type ProductLike = {
  id?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  images?: string[] | null;
} | null | undefined;

export function orderItemProductView(product: ProductLike): {
  title: string | null;
  image: string | null;
  href: string | null;
} {
  const title = product?.title?.trim() || null;
  const image = product?.imageUrl?.trim() || product?.images?.[0]?.trim() || null;
  const href = product?.id ? productPath({ id: product.id, title: product.title }) : null;
  return { title, image, href };
}
