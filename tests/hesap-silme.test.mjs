import test from "node:test";
import assert from "node:assert/strict";
import { approveDeletionRequest, cancelDeletionRequest, createDeletionRequest, rejectDeletionRequest, isOpenOrder, deletedEmail, isDeletedEmail, DELETED_NAME, DELETED_PASSWORD } from "../lib/account-deletion.ts";

// Bellek içi sahte DeletionDb (canlı veritabanı yok)
function fakeDb(seed = {}) {
  const s = {
    users: [
      { id: "u1", email: "ayse@example.com", name: "Ayşe Yılmaz", role: "USER", password: "scrypt$x$y", twoFactorEnabled: true },
      { id: "g1", email: "ayse+misafirab12@example.com", name: "Ayşe", role: "USER", password: "guest_checkout", twoFactorEnabled: false },
      { id: "u2", email: "baska@example.com", name: "Başka Kişi", role: "USER", password: "scrypt$a$b", twoFactorEnabled: false },
      { id: "adm", email: "admin@example.com", name: "Yönetici", role: "ADMIN", password: "scrypt$c$d", twoFactorEnabled: false },
    ],
    requests: [{ id: "r1", userId: "u1", status: "PENDING", adminNote: null, processedAt: null }],
    orders: [{ id: "o1", userId: "u1", status: "DELIVERED", cancelReturnStatus: null, phone: "0555" }],
    review: [{ id: "rv1", userId: "u1" }, { id: "rv2", userId: "u2" }],
    cartItem: [{ id: "c1", userId: "u1" }, { id: "c2", userId: "u2" }],
    address: [{ id: "a1", userId: "u1" }, { id: "a2", userId: "u2" }],
    favorite: [{ id: "f1", userId: "g1" }, { id: "f2", userId: "u2" }],
    contactMessages: [
      { id: "m1", userId: "u1", email: "ayse@example.com" },
      { id: "m2", userId: null, email: "AYSE@example.com" },
      { id: "m3", userId: "u2", email: "baska@example.com" },
    ],
    notifications: [
      { id: "n1", userId: "u1", userEmail: null },
      { id: "n2", userId: null, userEmail: "ayse@example.com" },
      { id: "n3", userId: null, userEmail: null }, // yönetici bildirimi
      { id: "n4", userId: "u2", userEmail: "baska@example.com" },
    ],
    verificationCode: [{ id: "v1", email: "ayse@example.com" }, { id: "v2", email: "baska@example.com" }],
    clientEvent: [{ id: "e1", email: "ayse@example.com" }, { id: "e2", email: null }],
    coupons: [
      { id: "k1", userEmail: "ayse@example.com", active: true, usedCount: 1 },
      { id: "k2", userEmail: null, active: true, usedCount: 0 },
    ],
    consents: [
      { email: "ayse@example.com", consentedAt: new Date("2026-01-01"), unsubscribedAt: null, ip: "1.1.1.1", userAgent: "UA" },
      { email: "baska@example.com", consentedAt: new Date("2026-01-01"), unsubscribedAt: null, ip: "2.2.2.2", userAgent: "UA" },
    ],
    locks: [],
    ...seed,
  };
  const lower = (e) => (e ?? "").toLowerCase();
  const db = {
    s,
    lockUser: async (id) => void s.locks.push(id),
    findUser: async (id) => s.users.find((u) => u.id === id) ?? null,
    findGuestSiblings: async (email) => {
      const [local, domain] = lower(email).split("@");
      return s.users.filter((u) => u.password === "guest_checkout" && lower(u.email).startsWith(`${local}+misafir`) && lower(u.email).endsWith(`@${domain}`)).map((u) => ({ id: u.id, email: u.email }));
    },
    findRequest: async (id) => s.requests.find((r) => r.id === id) ?? null,
    findPendingRequest: async (userId) => s.requests.find((r) => r.userId === userId && r.status === "PENDING") ?? null,
    createRequest: async (userId) => {
      const r = { id: `r${s.requests.length + 1}`, userId, status: "PENDING", adminNote: null, processedAt: null };
      s.requests.push(r);
      return r;
    },
    transitionRequest: async (id, to, note, now) => {
      const r = s.requests.find((x) => x.id === id && x.status === "PENDING");
      if (!r) return false;
      Object.assign(r, { status: to, adminNote: note, processedAt: now });
      return true;
    },
    listOrderStates: async (ids) => s.orders.filter((o) => ids.includes(o.userId)).map((o) => ({ status: o.status, cancelReturnStatus: o.cancelReturnStatus })),
    deleteByUser: async (kind, ids) => void (s[kind] = s[kind].filter((r) => !ids.includes(r.userId))),
    deleteByEmail: async (kind, emails) => void (s[kind] = s[kind].filter((r) => !emails.includes(lower(r.email)))),
    deleteContactMessages: async (ids, emails) => void (s.contactMessages = s.contactMessages.filter((m) => !(ids.includes(m.userId) || emails.includes(lower(m.email))))),
    deleteNotifications: async (ids, emails) => void (s.notifications = s.notifications.filter((n) => !(ids.includes(n.userId) || (n.userEmail && emails.includes(lower(n.userEmail)))))),
    deactivateCoupons: async (emails, anon) => s.coupons.forEach((c) => c.userEmail && emails.includes(lower(c.userEmail)) && Object.assign(c, { active: false, userEmail: anon })),
    unsubscribeMarketing: async (emails, now) => s.consents.forEach((c) => emails.includes(lower(c.email)) && Object.assign(c, { unsubscribedAt: c.unsubscribedAt ?? now, ip: null, userAgent: null })),
    anonymizeUser: async (id, d) => {
      const u = s.users.find((x) => x.id === id);
      Object.assign(u, d, { twoFactorEnabled: false, sessionVersion: (u.sessionVersion ?? 0) + 1 });
    },
  };
  return db;
}

test("açık sipariş tanımı: kapalı durumlar dışındakiler ve bekleyen iptal/iade açıktır", () => {
  for (const status of ["PENDING_NEW", "PENDING", "AWAITING_PAYMENT", "READY_FOR_PICKUP", "SHIPPED", "BILINMEYEN"]) assert.equal(isOpenOrder({ status, cancelReturnStatus: null }), true, status);
  for (const status of ["DELIVERED", "CANCELLED", "RETURNED", "PAYMENT_FAILED"]) assert.equal(isOpenOrder({ status, cancelReturnStatus: null }), false, status);
  assert.equal(isOpenOrder({ status: "DELIVERED", cancelReturnStatus: "PENDING" }), true);
  assert.equal(isOpenOrder({ status: "DELIVERED", cancelReturnStatus: "APPROVED" }), false);
});

test("onay: kişisel veriler silinir, hesap anonimleşir, sipariş korunur, başkasının verisine dokunulmaz", async () => {
  const db = fakeDb();
  const now = new Date("2026-11-13T10:00:00Z");
  const r = await approveDeletionRequest(db, "r1", "tamam", now);
  assert.deepEqual(r, { ok: true, email: "ayse@example.com", name: "Ayşe Yılmaz" }); // e-posta için anonimleştirme ÖNCESİ değerler
  const s = db.s;
  assert.equal(s.requests[0].status, "APPROVED");
  assert.equal(s.requests[0].adminNote, "tamam");
  assert.equal(s.requests[0].processedAt, now);
  assert.deepEqual(s.review.map((x) => x.id), ["rv2"]);
  assert.deepEqual(s.cartItem.map((x) => x.id), ["c2"]);
  assert.deepEqual(s.address.map((x) => x.id), ["a2"]);
  assert.deepEqual(s.favorite.map((x) => x.id), ["f2"]); // misafir kardeş hesabın favorisi de gitti
  assert.deepEqual(s.contactMessages.map((x) => x.id), ["m3"]); // büyük harfli e-posta da eşleşir
  assert.deepEqual(s.notifications.map((x) => x.id), ["n3", "n4"]); // yönetici bildirimi kalır
  assert.deepEqual(s.verificationCode.map((x) => x.id), ["v2"]);
  assert.deepEqual(s.clientEvent.map((x) => x.id), ["e2"]);
  assert.deepEqual(s.orders.map((x) => x.id), ["o1"]); // sipariş korunur
  assert.equal(s.orders[0].userId, "u1");
});

test("anonimleştirme: ad/e-posta/parola, 2FA kapanır, oturum sürümü artar; misafir kardeş de anonimleşir", async () => {
  const db = fakeDb();
  await approveDeletionRequest(db, "r1", null);
  for (const id of ["u1", "g1"]) {
    const u = db.s.users.find((x) => x.id === id);
    assert.equal(u.email, deletedEmail(id));
    assert.equal(isDeletedEmail(u.email), true);
    assert.match(u.email, /^silinmis-.+@silinmis\.invalid$/);
    assert.equal(u.name, DELETED_NAME);
    assert.equal(u.password, DELETED_PASSWORD);
    assert.equal(u.password.startsWith("scrypt$"), false); // hiçbir parola doğrulanamaz
    assert.equal(u.twoFactorEnabled, false);
    assert.equal(u.sessionVersion, 1);
  }
  const other = db.s.users.find((x) => x.id === "u2");
  assert.equal(other.email, "baska@example.com");
  assert.equal(other.name, "Başka Kişi");
});

test("pazarlama kaydı silinmez: abonelikten çıkış işaretlenir, ip/userAgent temizlenir; kupon kapanır ama kullanım geçmişi kalır", async () => {
  const db = fakeDb();
  const now = new Date("2026-11-13T10:00:00Z");
  await approveDeletionRequest(db, "r1", null, now);
  const [mine, theirs] = db.s.consents;
  assert.equal(mine.email, "ayse@example.com");
  assert.equal(mine.unsubscribedAt, now);
  assert.equal(mine.ip, null);
  assert.equal(mine.userAgent, null);
  assert.equal(theirs.unsubscribedAt, null);
  assert.equal(theirs.ip, "2.2.2.2");
  const [k1, k2] = db.s.coupons;
  assert.equal(k1.active, false);
  assert.equal(k1.userEmail, deletedEmail("u1"));
  assert.equal(k1.usedCount, 1);
  assert.equal(k2.active, true);
});

test("önceden abonelikten çıkmış kaydın tarihi korunur", async () => {
  const earlier = new Date("2026-02-02");
  const db = fakeDb();
  db.s.consents[0].unsubscribedAt = earlier;
  await approveDeletionRequest(db, "r1", null);
  assert.equal(db.s.consents[0].unsubscribedAt, earlier);
});

test("açık sipariş onayı engeller: hiçbir veri silinmez, talep PENDING kalır", async () => {
  for (const o of [{ status: "SHIPPED", cancelReturnStatus: null }, { status: "PENDING_NEW", cancelReturnStatus: null }, { status: "DELIVERED", cancelReturnStatus: "PENDING" }]) {
    const db = fakeDb();
    db.s.orders.push({ id: "o2", userId: "u1", ...o });
    const r = await approveDeletionRequest(db, "r1", null);
    assert.equal(r.ok, false);
    assert.equal(r.status, 409);
    assert.match(r.error, /tamamlanmamış 1 sipariş/);
    assert.equal(db.s.requests[0].status, "PENDING");
    assert.equal(db.s.review.length, 2);
    assert.equal(db.s.users[0].email, "ayse@example.com");
  }
});

test("misafir kardeş hesabın açık siparişi de onayı engeller", async () => {
  const db = fakeDb();
  db.s.orders.push({ id: "o3", userId: "g1", status: "AWAITING_PAYMENT", cancelReturnStatus: null });
  const r = await approveDeletionRequest(db, "r1", null);
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
  assert.equal(db.s.users[1].email, "ayse+misafirab12@example.com");
});

test("başka kişinin açık siparişi onayı engellemez", async () => {
  const db = fakeDb();
  db.s.orders.push({ id: "o9", userId: "u2", status: "SHIPPED", cancelReturnStatus: null });
  assert.equal((await approveDeletionRequest(db, "r1", null)).ok, true);
});

test("idempotent: işlenmiş talep ikinci kez veriyi değiştirmez", async () => {
  const db = fakeDb();
  assert.equal((await approveDeletionRequest(db, "r1", null)).ok, true);
  const snapshot = JSON.stringify(db.s);
  const again = await approveDeletionRequest(db, "r1", "tekrar");
  assert.equal(again.ok, false);
  assert.equal(again.status, 409);
  assert.equal(JSON.stringify(db.s), snapshot);
});

test("eşzamanlı iki onay: yalnızca biri kazanır (koşullu geçiş)", async () => {
  const db = fakeDb();
  const orig = db.findRequest;
  db.findRequest = async (id) => ({ ...(await orig(id)), status: "PENDING" }); // ikisi de PENDING görür (yarış)
  const [a, b] = await Promise.all([approveDeletionRequest(db, "r1", null), approveDeletionRequest(db, "r1", null)]);
  assert.equal([a, b].filter((x) => x.ok).length, 1);
  assert.equal([a, b].find((x) => !x.ok).status, 409);
});

test("yönetici hesabı ve olmayan talep/hesap reddedilir", async () => {
  const db = fakeDb();
  db.s.requests.push({ id: "r2", userId: "adm", status: "PENDING", adminNote: null, processedAt: null });
  const adm = await approveDeletionRequest(db, "r2", null);
  assert.equal(adm.status, 403);
  assert.equal(db.s.users[3].email, "admin@example.com");
  assert.equal((await approveDeletionRequest(db, "yok", null)).status, 404);
  db.s.requests.push({ id: "r3", userId: "hayalet", status: "PENDING", adminNote: null, processedAt: null });
  assert.equal((await approveDeletionRequest(db, "r3", null)).status, 404);
});

test("ret: talep REDDEDİLDİ olur, veri değişmez; ikinci ret 409", async () => {
  const db = fakeDb();
  const before = JSON.stringify({ ...db.s, requests: undefined });
  const r = await rejectDeletionRequest(db, "r1", "açık iade var");
  assert.deepEqual(r, { ok: true, userId: "u1" });
  assert.equal(db.s.requests[0].status, "REJECTED");
  assert.equal(db.s.requests[0].adminNote, "açık iade var");
  assert.equal(JSON.stringify({ ...db.s, requests: undefined }), before);
  assert.equal((await rejectDeletionRequest(db, "r1", null)).status, 409);
  assert.equal((await rejectDeletionRequest(db, "yok", null)).status, 404);
});

test("talep oluşturma: tek bekleyen talep (çift tık yeni kayıt açmaz); yönetici açamaz; iptal sonrası yeniden açılabilir", async () => {
  const db = fakeDb({ requests: [] });
  const first = await createDeletionRequest(db, "u1");
  assert.equal(first.ok && first.created, true);
  assert.equal(first.email, "ayse@example.com");
  const second = await createDeletionRequest(db, "u1");
  assert.equal(second.ok && second.created, false);
  assert.equal(db.s.requests.length, 1);
  assert.equal((await createDeletionRequest(db, "adm")).status, 403);
  assert.equal((await createDeletionRequest(db, "yok")).status, 401);
  assert.deepEqual(await cancelDeletionRequest(db, "u1"), { ok: true });
  assert.equal(db.s.requests[0].status, "CANCELLED");
  assert.equal((await cancelDeletionRequest(db, "u1")).status, 404);
  const again = await createDeletionRequest(db, "u1");
  assert.equal(again.ok && again.created, true);
  assert.equal(db.s.requests.length, 2);
});

test("iptal yalnızca kendi talebini etkiler", async () => {
  const db = fakeDb();
  assert.equal((await cancelDeletionRequest(db, "u2")).status, 404);
  assert.equal(db.s.requests[0].status, "PENDING");
});
