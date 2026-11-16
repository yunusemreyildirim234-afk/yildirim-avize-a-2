"use server";

import type { ReactNode } from "react";
import { headers } from "next/headers";
import ProductCard from "@/components/ProductCard";
import { rateLimit } from "@/lib/rate-limit";
import { loadCartProducts } from "@/lib/cart-products";

type CartMoreResult = { ok: true; items: { id: string; node: ReactNode }[]; cursor: number; hasMore: boolean } | { ok: false; limited?: boolean };

/**
 * Sepet sayfası "Sepetinize uygun diğer ürünler" şeridi: sepetteki ürünlerin kategorilerinden karışık, sepette olmayan ürünlerin sonraki 8'i. Salt okunur.
 * Sepet içeriği yalnızca bu istekte kullanılır; kart önbelleği anahtarına girmez (lib/cart-products.ts). `cursor`: önceki yanıtın cursor değeri.
 * IP bazlı hız sınırı loadSimilar ile aynı yol ve aynı sınır (ayrı sayaç): 10 dakikada en çok 60 istek.
 */
export async function loadCartMore(productIds: string[], cursor: number): Promise<CartMoreResult> {
  if (!Array.isArray(productIds) || productIds.length === 0 || productIds.length > 50 || productIds.some((id) => typeof id !== "string" || id.length === 0 || id.length > 64) || !Number.isInteger(cursor) || cursor < 0 || cursor > 5000) return { ok: false };
  try {
    const rl = rateLimit(new Request("http://localhost/sepet-serit", { headers: await headers() }), "sepet-serit", 60, 10 * 60_000);
    if (rl.limited) return { ok: false, limited: true };
    const page = await loadCartProducts(productIds, cursor);
    return { ok: true, items: page.items.map((p) => ({ id: p.id, node: <ProductCard key={p.id} product={p} /> })), cursor: page.cursor, hasMore: page.hasMore };
  } catch (e) {
    console.error("[cart-more] ürünler getirilemedi:", (e as Error).message);
    return { ok: false };
  }
}
