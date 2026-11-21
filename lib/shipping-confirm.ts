// Barkod öncesi firma onayı (saf çekirdek; Kargonomi çağrıları parametredir, test edilebilir).
import { KargonomiError } from "@/lib/kargonomi";
import { parseQuotes, type SelectableProviderId } from "@/lib/carrier-quotes";

export interface ShipmentState {
  kargonomiShipmentId: number | null;
  kargonomiStatus: string | null;
  shippingProviderId: number | null;
  shippingProviderName: string | null;
  barcodeUrl: string | null;
  shippingTrackingCode: string | null;
  shippingBarcode: string | null;
}

export interface ConfirmDeps<S extends ShipmentState> {
  /** Yeni taslak gönderi açar (regenerate dahil). */
  createDraft: () => Promise<S>;
  /** Mevcut gönderiyi Kargonomi'den yenileyip siparişe yansıtır (firma senkronu dahil). */
  refresh: () => Promise<S>;
  getPriceComparison: (shipmentId: number) => Promise<unknown>;
  confirmShippingPrice: (shipmentId: number, providerId: number) => Promise<unknown>;
}

export const PROVIDER_LABEL: Record<number, string> = { 4: "Aras Kargo", 6: "Hepsijet" };

/**
 * - Gönderi yoksa (ya da regenerate) taslak açılır; taslaksa seçilen firma SUNUCUDA yeniden doğrulanır (kullanılamazsa 409),
 *   confirm edilir ve gönderi yenilenir.
 * - Gönderi zaten taslak değilse (panelde onaylanmış) İKİNCİ confirm yapılmaz; yalnız yenileme + firma senkronu.
 * `confirmed`: bu çağrıda confirm yapıldıysa seçilen firma (Kargonomi yanıtında firma yoksa yedek olarak yazılır).
 */
export async function openShipmentWithProvider<S extends ShipmentState>(
  opts: { hasShipment: boolean; regenerate: boolean; providerId: SelectableProviderId },
  deps: ConfirmDeps<S>
): Promise<{ shipment: S; confirmed: SelectableProviderId | null }> {
  let s = !opts.hasShipment || opts.regenerate ? await deps.createDraft() : await deps.refresh();
  if (s.kargonomiStatus && s.kargonomiStatus !== "draft") return { shipment: s, confirmed: null };
  const id = s.kargonomiShipmentId;
  if (!id) throw new KargonomiError("Kargonomi gönderi kimliği yok.", 502);

  const quote = parseQuotes(await deps.getPriceComparison(id)).find((q) => q.providerId === opts.providerId);
  if (!quote?.available) {
    throw new KargonomiError(`${PROVIDER_LABEL[opts.providerId]} bu gönderi için kullanılamıyor (hizmet dışı bölge veya fiyat alınamadı). Başka firmayı seçin.`, 409);
  }
  await deps.confirmShippingPrice(id, opts.providerId);
  s = await deps.refresh();
  return { shipment: s, confirmed: opts.providerId };
}
