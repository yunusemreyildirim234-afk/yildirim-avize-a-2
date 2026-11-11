// Adres defteri: Prisma işlemini (transaction) AddressDb arayüzüne bağlar (kurallar lib/address-store.ts içindedir).
import type { Prisma } from "@/generated/prisma/client";
import type { AddressDb, AddressRow } from "@/lib/address-store";

export function addressDbFor(tx: Prisma.TransactionClient): AddressDb {
  return {
    // Aynı kullanıcının eşzamanlı adres yazmaları sıraya girer (adres sayısı sınırı ve tek varsayılan korunur)
    lockUser: async (userId) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    },
    list: (userId) => tx.address.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    find: (id, userId) => tx.address.findFirst({ where: { id, userId } }),
    create: (data) => tx.address.create({ data }),
    update: (id, data) => tx.address.update({ where: { id }, data }),
    clearDefault: async (userId, exceptId) => {
      await tx.address.updateMany({ where: { userId, isDefault: true, ...(exceptId ? { id: { not: exceptId } } : {}) }, data: { isDefault: false } });
    },
    remove: async (id) => {
      await tx.address.delete({ where: { id } });
    },
  };
}

/** Yanıtta kullanıcı kimliği dönmez. */
export const toPublicAddress = (r: AddressRow) => ({
  id: r.id,
  title: r.title,
  fullName: r.fullName,
  phone: r.phone,
  stateId: r.stateId,
  stateName: r.stateName,
  cityId: r.cityId,
  cityName: r.cityName,
  address: r.address,
  isDefault: r.isDefault,
});
