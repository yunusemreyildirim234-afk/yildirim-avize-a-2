// Tamamlayıcı öneri yükleyici (SALT OKUNUR). Ürün sayfası (sunucu) ve /api/cart/complements aynı sorguyu kullanır.
import { prisma } from "@/lib/db";
import { buildSuggestions, MAX_SUGGEST_COUNT, type Suggestion } from "@/lib/complements";

const MAX_ROWS = 100;

/**
 * `mainIds` ana ürünlerinin tamamlayıcıları. TEK sorgu (bağ + tamamlayıcı ürün + varyasyonlar, yalnız gerekli alanlar);
 * bağ yoksa ayar sorgusu hiç atılmaz (uyku hâlinde çağrı başına 1 sorgu). `hideIds` (sepetteki ürünler) elenir ve sayıya girmez.
 * `all: true` → ayar yerine üst sınır (12) kadar döner; ayar 0 ise yine boş (ürün sayfası sepeti istemcide kendisi süzer).
 */
export async function loadSuggestions(mainIds: string[], hideIds: ReadonlySet<string>, opts: { all?: boolean } = {}): Promise<{ suggestions: Suggestion[]; count: number | null }> {
  if (mainIds.length === 0) return { suggestions: [], count: null };
  const rows = await prisma.productComplement.findMany({
    where: { mainProductId: { in: mainIds } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    take: MAX_ROWS,
    select: {
      mainProductId: true,
      discountType: true,
      discountValue: true,
      position: true,
      createdAt: true,
      complementProduct: {
        select: {
          id: true, title: true, active: true, basePrice: true, listPrice: true, imageUrl: true, images: true, bulkTiers: true,
          couponAllowed: true, pickupDiscountPct: true, transferDiscountPct: true,
          variations: { select: { id: true, variationType: true, variationValue: true, extraPrice: true, stock: true, images: true } },
        },
      },
    },
  });
  if (rows.length === 0) return { suggestions: [], count: null };
  const cfg = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { complementSuggestCount: true } });
  const count = cfg?.complementSuggestCount ?? null;
  const suggestions = buildSuggestions(
    rows.map(({ complementProduct, ...r }) => ({ ...r, complement: complementProduct })),
    hideIds,
    opts.all ? (count === 0 ? 0 : MAX_SUGGEST_COUNT) : count
  );
  return { suggestions, count };
}
