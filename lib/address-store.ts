// Adres defteri yazma kuralları (saf mantık). Veritabanı erişimi `AddressDb` arayüzü arkasındadır; gerçek bağlantı app/api/user/addresses/*
// içinde Prisma işlemine (transaction) bağlanır, testler bellek içi sahte uygulama kullanır.
// Aynı kullanıcının yazmaları kullanıcı satırı kilidiyle sıralanır: en çok MAX_ADDRESSES adres ve her zaman tek varsayılan.
import { MAX_ADDRESSES, nextDefaultAfterDelete, shouldBeDefault, type AddressInput } from "./address-book.ts";

export interface AddressRow extends AddressInput {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddressDb {
  lockUser(userId: string): Promise<void>;
  list(userId: string): Promise<AddressRow[]>;
  /** Yalnızca sahibine aitse döner (IDOR): başkasının adresi null. */
  find(id: string, userId: string): Promise<AddressRow | null>;
  create(data: AddressInput & { userId: string }): Promise<AddressRow>;
  update(id: string, data: Partial<AddressInput>): Promise<AddressRow>;
  clearDefault(userId: string, exceptId?: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export type StoreResult<T> = { ok: true; row: T } | { ok: false; status: number; error: string };

export const NOT_FOUND = { ok: false as const, status: 404, error: "Adres bulunamadı." };
export const LIMIT_ERROR = `En fazla ${MAX_ADDRESSES} adres kaydedebilirsiniz. Yeni eklemek için birini silin.`;

export async function createAddress(db: AddressDb, userId: string, input: AddressInput): Promise<StoreResult<AddressRow>> {
  await db.lockUser(userId);
  const existing = await db.list(userId);
  if (existing.length >= MAX_ADDRESSES) return { ok: false, status: 400, error: LIMIT_ERROR };
  const isDefault = shouldBeDefault(existing.length, input.isDefault);
  if (isDefault) await db.clearDefault(userId);
  return { ok: true, row: await db.create({ ...input, userId, isDefault }) };
}

export async function updateAddress(db: AddressDb, userId: string, id: string, input: AddressInput): Promise<StoreResult<AddressRow>> {
  await db.lockUser(userId);
  const current = await db.find(id, userId);
  if (!current) return NOT_FOUND;
  // Varsayılan adresin işareti bu uçla kaldırılamaz (başka bir adresi varsayılan yapmak gerekir): her zaman bir varsayılan kalır
  const isDefault = input.isDefault || current.isDefault;
  if (isDefault && !current.isDefault) await db.clearDefault(userId, id);
  return { ok: true, row: await db.update(id, { ...input, isDefault }) };
}

export async function deleteAddress(db: AddressDb, userId: string, id: string): Promise<StoreResult<{ id: string }>> {
  await db.lockUser(userId);
  const current = await db.find(id, userId);
  if (!current) return NOT_FOUND;
  await db.remove(id);
  const next = nextDefaultAfterDelete(await db.list(userId), current.isDefault);
  if (next) await db.update(next, { isDefault: true });
  return { ok: true, row: { id } };
}
