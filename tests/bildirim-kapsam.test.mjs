import test from "node:test";
import assert from "node:assert/strict";
import { buildNotificationWhere, parseNotificationScope } from "../lib/notification-scope.ts";

const user = { id: "u1", email: "a@b.com" };
const both = { user, admin: true };
const isAdminSet = (w) => w.OR.length === 1 && w.OR[0].userId === null && w.OR[0].userEmail === null;
const isUserSet = (w) => w.OR.length === 2 && w.OR[0].userId === "u1" && w.OR[1].userEmail.equals === "a@b.com";

test("scope ayrıştırma", () => {
  assert.equal(parseNotificationScope("admin"), "admin");
  assert.equal(parseNotificationScope("user"), "user");
  for (const v of [null, "", "x", "ADMIN"]) assert.equal(parseNotificationScope(v), null);
});

test("çift oturum: her scope yalnızca kendi kümesi (okuma, okundu, silme)", () => {
  for (const mode of ["read", "delete"]) {
    assert.ok(isAdminSet(buildNotificationWhere(both, "admin", mode)));
    assert.ok(isUserSet(buildNotificationWhere(both, "user", mode)));
  }
});

test("scope yok: okuma eski davranış (ikisi birlikte), silme yalnızca müşteri kümesi", () => {
  assert.equal(buildNotificationWhere(both, null, "read").OR.length, 3);
  assert.ok(isUserSet(buildNotificationWhere(both, null, "delete")));
});

test("tek oturum ve oturumsuz", () => {
  assert.ok(isAdminSet(buildNotificationWhere({ user: null, admin: true }, "admin")));
  assert.ok(isAdminSet(buildNotificationWhere({ user: null, admin: true }, "user"))); // yalnızca yönetici açık, herkese açık sayfa zili
  assert.ok(isAdminSet(buildNotificationWhere({ user: null, admin: true }, null, "delete")));
  assert.equal(buildNotificationWhere({ user, admin: false }, "admin"), null); // müşteri yönetici kümesini göremez/silemez
  assert.ok(isUserSet(buildNotificationWhere({ user, admin: false }, "user")));
  assert.equal(buildNotificationWhere({ user: null, admin: false }, "user"), null);
});

test("uç ve zil kapsamı bağlı", async () => {
  const { readFileSync } = await import("node:fs");
  const route = readFileSync(new URL("../app/api/notifications/route.ts", import.meta.url), "utf8");
  assert.match(route, /buildNotificationWhere/);
  assert.match(route, /scope\(req, "delete"\)/);
  const bell = readFileSync(new URL("../components/NotificationBell.tsx", import.meta.url), "utf8");
  assert.match(bell, /startsWith\("\/admin"\) \? "\?scope=admin" : "\?scope=user"/);
  assert.ok(!/"\/api\/notifications"/.test(bell));
});
