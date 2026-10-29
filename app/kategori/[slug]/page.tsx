import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductCard from "@/components/ProductCard";
import { prisma } from "@/lib/db";
import { DISCOUNTED, FEATURED, getProducts } from "@/lib/products";
import { CATEGORIES, COLLECTIONS } from "@/lib/site";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

const slugify = (v: string) =>
  v
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function resolve(slug: string) {
  const category = CATEGORIES.find((c) => c.slug === slug);
  if (category) return { title: category.title, desc: category.desc, where: { category: category.dbCategory } };
  if (slug === "tum") return { ...COLLECTIONS.tum, where: {} };
  if (slug === "one-cikanlar") return { ...COLLECTIONS["one-cikanlar"], where: FEATURED };
  if (slug === "indirimli") return { ...COLLECTIONS.indirimli, where: DISCOUNTED };

  // Yönetim panelinden eklenen yeni koleksiyonlar
  const rows = await prisma.product.groupBy({ by: ["category"], where: { active: true } });
  const match = rows.find((r: { category: string }) => slugify(r.category) === slug);
  if (match) return { title: match.category, desc: `${match.category} koleksiyonundaki avize ve aydınlatma modelleri.`, where: { category: match.category } };
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const current = await resolve(slug);
  if (!current) return {};
  return {
    title: current.title,
    description: current.desc,
    alternates: { canonical: `/kategori/${slug}` },
    openGraph: { title: current.title, description: current.desc, url: `/kategori/${slug}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const current = await resolve(slug);
  if (!current) notFound();

  const products = await getProducts(current.where);

  return (
    <main className="min-h-screen bg-white pb-20">
      <section className="bg-zinc-50 border-b border-zinc-200 py-12 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-3">
          <Breadcrumbs
            className="text-zinc-500 mb-2 flex justify-center"
            items={[{ name: "Ana Sayfa", href: "/" }, { name: current.title, href: `/kategori/${slug}` }]}
          />
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-zinc-900">{current.title}</h1>
          <p className="text-sm text-zinc-600 max-w-xl mx-auto">{current.desc}</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4 mb-8 text-xs text-zinc-500">
          <span>{products.length} ürün listeleniyor</span>
          <span className="text-amber-700 font-medium hidden sm:inline">📍 Beyoğlu Mağazasında Sergilenen Modeller</span>
        </div>

        {products.length === 0 ? (
          <div className="bg-zinc-50 rounded-3xl border border-zinc-200 p-12 text-center max-w-md mx-auto space-y-3">
            <span className="text-3xl block" aria-hidden="true">💡</span>
            <h2 className="font-serif font-bold text-zinc-900 text-base">Bu listede henüz ürün yok</h2>
            <Link
              href="/kategori/tum"
              className="inline-block bg-zinc-900 hover:bg-amber-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors mt-2"
            >
              Tüm Ürünleri Gör
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
