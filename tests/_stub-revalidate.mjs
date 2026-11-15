// Gerçek kuralı (lib/revalidate-rule.ts) kullanır; yenileme yerine sayaç artırır.
import { shouldRevalidate } from "../lib/revalidate-rule.ts";
export const withStorefrontRevalidate = (handler) => async (...args) => {
  const res = await handler(...args);
  if (shouldRevalidate(res)) globalThis.__revalidated = (globalThis.__revalidated ?? 0) + 1;
  return res;
};
