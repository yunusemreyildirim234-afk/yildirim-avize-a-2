// Adres defteri: saf kurallar (veritabanı yok). Doğrulama sepet formu ve /api/order ile AYNI fonksiyonları kullanır
// (shippingFormError: ad en az iki kelime, il/ilçe seçili, adres en az 10 karakter; isValidPhone: telefon).
import { shippingFormError } from "./validation.ts";
import { isValidPhone, PHONE_ERROR } from "./phone.ts";

export const MAX_ADDRESSES = 10;
export const MAX_ADDRESS_TITLE = 40;
export const DEFAULT_ADDRESS_TITLE = "Adresim";

export interface AddressInput {
  title: string;
  fullName: string;
  phone: string;
  stateId: number;
  stateName: string;
  cityId: number;
  cityName: string;
  address: string;
  isDefault: boolean;
}

export type AddressResult = { ok: true; data: AddressInput } | { ok: false; error: string; field: string };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** İstek gövdesini doğrular ve temizler. Kısmi güncelleme yok: tüm alanlar her seferinde gönderilir. */
export function cleanAddressInput(body: unknown): AddressResult {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const fullName = collapse(str(b.fullName));
  const phone = str(b.phone).trim();
  const address = str(b.address).trim();
  const title = collapse(str(b.title)) || DEFAULT_ADDRESS_TITLE;
  const stateName = collapse(str(b.stateName));
  const cityName = collapse(str(b.cityName));
  const bad = (field: string, error: string): AddressResult => ({ ok: false, field, error });

  if (title.length > MAX_ADDRESS_TITLE) return bad("title", `Adres başlığı en çok ${MAX_ADDRESS_TITLE} karakter olabilir.`);
  if (fullName.length > 120 || phone.length > 30 || address.length > 500) return bad("address", "Ad, telefon veya adres çok uzun.");
  const form = shippingFormError({ name: fullName, address, stateId: b.stateId, cityId: b.cityId, isPickup: false });
  if (form) return bad(form.field, form.message);
  if (!isValidPhone(phone)) return bad("phone", PHONE_ERROR);
  if (!stateName || stateName.length > 80 || !cityName || cityName.length > 80) return bad("state", "Lütfen il ve ilçeyi listeden seçin.");

  return {
    ok: true,
    data: { title, fullName, phone, stateId: Number(b.stateId), stateName, cityId: Number(b.cityId), cityName, address, isDefault: b.isDefault === true },
  };
}

/** Varsayılan adres: işaretlenen, yoksa ilk (en eski) adres. Tek varsayılan olmalıdır. */
export function pickDefault<T extends { isDefault: boolean }>(list: T[]): T | null {
  return list.find((a) => a.isDefault) ?? list[0] ?? null;
}

/** Listeyi gösterim sırasına koyar: varsayılan önce, sonra en yeni. */
export function sortAddresses<T extends { isDefault: boolean; createdAt: Date | string }>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Yeni adres varsayılan mı olacak? İlk adres her zaman varsayılan; sonrakiler yalnızca işaretlenirse. */
export const shouldBeDefault = (existingCount: number, requested: boolean) => existingCount === 0 || requested;

/** Silinen adres varsayılansa kalanlardan en yenisi varsayılan olur (null: kalan yok, silinen varsayılan değildi ya da zaten bir varsayılan var). */
export function nextDefaultAfterDelete<T extends { id: string; isDefault: boolean; createdAt: Date | string }>(remaining: T[], deletedWasDefault: boolean): string | null {
  if (!deletedWasDefault || remaining.length === 0 || remaining.some((a) => a.isDefault)) return null;
  return sortAddresses(remaining)[0].id;
}
