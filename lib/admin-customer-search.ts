// Kupon formundaki müşteri e-posta önerisi: en az 2 karakter, en çok 10 kayıt, yalnız ad + e-posta; misafir ödeme hesapları hariç.
export const CUSTOMER_SEARCH_MIN = 2;
export const CUSTOMER_SEARCH_LIMIT = 10;

export function normalizeCustomerQuery(raw: string | null): string | null {
  const q = (raw ?? "").trim();
  return q.length >= CUSTOMER_SEARCH_MIN && q.length <= 100 ? q : null;
}

export function customerSearchWhere(q: string) {
  return {
    role: "USER" as const,
    password: { not: "guest_checkout" },
    NOT: { email: { contains: "+misafir", mode: "insensitive" as const } },
    OR: [
      { email: { startsWith: q, mode: "insensitive" as const } },
      { name: { startsWith: q, mode: "insensitive" as const } },
    ],
  };
}
