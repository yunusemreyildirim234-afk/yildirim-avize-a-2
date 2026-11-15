// Sahte bağımlılıklar (yalnız testler). Tek dosya, birden çok modülün adlandırılmış dışa aktarımlarını birleştirir.
export const getSessionUserId = async () => null;
export const releaseStaleReservations = async () => 0;
export const planPendingSwap = async () => ({ blocked: false, swapIds: [], heldStock: new Map(), heldCoupons: [] });
export const bankPendingLimitReached = async () => false;
export const finalizeOrder = async () => {};
export const swapAndCreate = async (_tx, _ids, _release, create) => create();
export const closeAwaitingCardInTx = async () => {};
export const shouldPlanSwapForQuote = () => false;
export const stockWithHeld = (stock) => stock;
export const getPaytrToken = async () => "tok";
export const recordConsent = async () => {};
export const revalidateStorefrontSafe = () => {};
export const getLadderContextFresh = async () => null;
