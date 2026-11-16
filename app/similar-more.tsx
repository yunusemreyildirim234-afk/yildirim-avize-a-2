"use server";

import type { ReactNode } from "react";
import { headers } from "next/headers";
import ProductCard from "@/components/ProductCard";
import { rateLimit } from "@/lib/rate-limit";
import { loadSimilarProducts } from "@/lib/similar-products";

type SimilarResult = { ok: true; items: { id: string; node: ReactNode }[]; cursor: number; hasMore: boolean } | { ok: false; limited?: boolean };

/**
 * Ürün sayfası "Benzer Avize Modelleri" şeridi: sonraki 8 ürünü SONA YAKLAŞILINCA getirir. Salt okunur; liste ve kurallar sayfadakiyle aynı (lib/similar-products.ts).
 * Kartlar sunucuda üretilir (ProductCard sunucu bileşeni). IP bazlı hız sınırı: bir ziyaretçi 10 dakikada en çok 60 istek (100 ürünlük kategori ≈ 12 istek).
 * `cursor`: önceki yanıtın cursor değeri (listede ilerlenen konum).
 */
export async function loadSimilar(category: string, excludeId: string, cursor: number): Promise<SimilarResult> {
  if (typeof category !== "string" || !category.trim() || category.length > 120 || typeof excludeId !== "string" || excludeId.length > 64 || !Number.isInteger(cursor) || cursor < 0 || cursor > 5000) return { ok: false };
  try {
    const rl = rateLimit(new Request("http://localhost/benzer-serit", { headers: await headers() }), "benzer-serit", 60, 10 * 60_000);
    if (rl.limited) return { ok: false, limited: true };
    const page = await loadSimilarProducts(category, excludeId, cursor);
    return { ok: true, items: page.items.map((p) => ({ id: p.id, node: <ProductCard key={p.id} product={p} /> })), cursor: page.cursor, hasMore: page.hasMore };
  } catch (e) {
    console.error("[similar-more] ürünler getirilemedi:", (e as Error).message);
    return { ok: false };
  }
}
