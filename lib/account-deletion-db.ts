// Hesap silme: Prisma işlemini (transaction) DeletionDb arayüzüne bağlar (kurallar lib/account-deletion.ts içindedir).
import type { Prisma } from "@/generated/prisma/client";
import type { DeletionDb } from "@/lib/account-deletion";

const GUEST_PASSWORD = "guest_checkout";

const anyOf = (field: string, emails: string[]) => emails.map((e) => ({ [field]: { equals: e, mode: "insensitive" as const } }));

export function deletionDbFor(tx: Prisma.TransactionClient): DeletionDb {
  return {
    lockUser: async (userId) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR NO KEY UPDATE`;
    },
    findUser: (userId) => tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true } }),
    findGuestSiblings: async (email) => {
      const at = email.lastIndexOf("@");
      if (at < 1) return [];
      const local = email.slice(0, at);
      const domain = email.slice(at + 1);
      return tx.user.findMany({
        where: { password: GUEST_PASSWORD, email: { startsWith: `${local}+misafir`, endsWith: `@${domain}`, mode: "insensitive" } },
        select: { id: true, email: true },
      });
    },
    findRequest: (id) => tx.accountDeletionRequest.findUnique({ where: { id }, select: { id: true, userId: true, status: true } }),
    findPendingRequest: (userId) => tx.accountDeletionRequest.findFirst({ where: { userId, status: "PENDING" }, select: { id: true, userId: true, status: true } }),
    createRequest: async (userId) => {
      try {
        return await tx.accountDeletionRequest.create({ data: { userId }, select: { id: true, userId: true, status: true } });
      } catch (err) {
        // Kısmi unique indeks (kullanıcı başına tek PENDING): eşzamanlı ikinci istek mevcut talebi döndürür
        if ((err as { code?: string }).code === "P2002") {
          const existing = await tx.accountDeletionRequest.findFirst({ where: { userId, status: "PENDING" }, select: { id: true, userId: true, status: true } });
          if (existing) return existing;
        }
        throw err;
      }
    },
    transitionRequest: async (id, to, adminNote, now) => {
      const res = await tx.accountDeletionRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: to, adminNote, processedAt: now } });
      return res.count === 1;
    },
    listOrderStates: (userIds) => tx.order.findMany({ where: { userId: { in: userIds } }, select: { status: true, cancelReturnStatus: true } }),
    deleteByUser: async (kind, userIds) => {
      const where = { userId: { in: userIds } };
      if (kind === "review") await tx.review.deleteMany({ where }); // ReviewImage veritabanında cascade
      else if (kind === "cartItem") await tx.cartItem.deleteMany({ where });
      else if (kind === "address") await tx.address.deleteMany({ where });
      else await tx.favorite.deleteMany({ where });
    },
    deleteByEmail: async (kind, emails) => {
      const where = { OR: anyOf("email", emails) };
      if (kind === "verificationCode") await tx.verificationCode.deleteMany({ where });
      else await tx.clientEvent.deleteMany({ where });
    },
    deleteContactMessages: async (userIds, emails) => {
      await tx.contactMessage.deleteMany({ where: { OR: [{ userId: { in: userIds } }, ...anyOf("email", emails)] } });
    },
    deleteNotifications: async (userIds, emails) => {
      await tx.notification.deleteMany({ where: { OR: [{ userId: { in: userIds } }, ...anyOf("userEmail", emails)] } });
    },
    deactivateCoupons: async (emails, anonymousEmail) => {
      await tx.coupon.updateMany({ where: { OR: anyOf("userEmail", emails) }, data: { active: false, userEmail: anonymousEmail } });
    },
    unsubscribeMarketing: async (emails, now) => {
      await tx.marketingConsent.updateMany({ where: { OR: anyOf("email", emails), unsubscribedAt: null }, data: { unsubscribedAt: now } });
      await tx.marketingConsent.updateMany({ where: { OR: anyOf("email", emails) }, data: { ip: null, userAgent: null } });
    },
    anonymizeUser: async (userId, data) => {
      await tx.user.update({ where: { id: userId }, data: { ...data, twoFactorEnabled: false, lastLoginAt: null, sessionVersion: { increment: 1 } } });
    },
  };
}
