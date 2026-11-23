import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

// DAVRANIŞ: hesap silme yönetici ucu GERÇEK kodla (ve gerçek approveDeletionRequest ile) çalışır; veritabanı, e-posta, bildirim sahtedir.
register("./_hooks-davranis.mjs", import.meta.url);
const route = await import("../app/api/admin/account-deletions/route.ts");

let st; // { tx: bool, writes: [], orders, user }
function setup({ orders = [], role = "USER" } = {}) {
  st = { inTx: false, writes: [], touched: 0 };
  globalThis.__olaylar = [];
  globalThis.__mails = [];
  globalThis.__adminAuthed = true;
  const w = (n) => async (...a) => { assert.ok(st.inTx, `${n} işlem (transaction) dışında çağrıldı`); st.writes.push(n); return a; };
  globalThis.__deletionDb = () => ({
    lockUser: async () => {}, findUser: async () => ({ id: "u1", email: "ali@example.com", name: "Ali", role }),
    findGuestSiblings: async () => [], findRequest: async () => ({ id: "r1", userId: "u1", status: "PENDING" }), findPendingRequest: async () => null,
    createRequest: async () => ({}), transitionRequest: async () => (st.writes.push("transition"), true), listOrderStates: async () => orders,
    deleteByUser: w("deleteByUser"), deleteByEmail: w("deleteByEmail"), deleteContactMessages: w("deleteContactMessages"), deleteNotifications: w("deleteNotifications"),
    deactivateCoupons: w("deactivateCoupons"), unsubscribeMarketing: w("unsubscribeMarketing"),
    anonymizeUser: async (id, d) => (st.writes.push(`anon:${d.email}`), void globalThis.__olaylar.push("anonimlestirme")),
  });
  globalThis.__fakePrisma = {
    $transaction: async (fn) => {
      st.touched++;
      st.inTx = true;
      try { return await fn({}); } finally { st.inTx = false; globalThis.__olaylar.push("tx-bitti"); }
    },
    accountDeletionRequest: { findMany: async () => (st.touched++, []) },
    order: { findMany: async () => (st.touched++, []) },
  };
}
const patch = (body) => route.PATCH(new Request("http://x/api", { method: "PATCH", body: JSON.stringify(body) }));

test("yetkisiz GET ve PATCH 401: depoya hiç dokunulmaz", async () => {
  setup();
  globalThis.__adminAuthed = false;
  assert.equal((await route.GET()).status, 401);
  assert.equal((await patch({ id: "r1", action: "approve" })).status, 401);
  assert.equal(st.touched, 0);
  assert.equal(st.writes.length, 0);
});

test("geçersiz istek 400: işlem açılmaz", async () => {
  setup();
  assert.equal((await patch({ id: "r1", action: "sil" })).status, 400);
  assert.equal((await patch({ action: "approve" })).status, 400);
  assert.equal(st.touched, 0);
});

test("onay: tüm silme/anonimleştirme yazıları TEK işlemde; e-posta işlem BİTTİKTEN sonra, anonimleştirmeden önce okunan gerçek adrese", async () => {
  setup();
  const res = await patch({ id: "r1", action: "approve", adminNote: "tamam" });
  assert.equal(res.status, 200);
  assert.ok(st.writes.includes("anon:silinmis-u1@silinmis.invalid"));
  assert.ok(st.writes.includes("deleteByUser") && st.writes.includes("deactivateCoupons"));
  assert.deepEqual(globalThis.__mails.map((m) => [m.ad, m.to, m.name]), [["hesap-silindi", "ali@example.com", "Ali"]]);
  const sira = globalThis.__olaylar;
  assert.ok(sira.indexOf("tx-bitti") < sira.indexOf("mail:hesap-silindi"), "e-posta işlemden sonra");
  assert.ok(sira.indexOf("anonimlestirme") < sira.indexOf("tx-bitti"));
});

test("açık siparişi olan hesap silinemez: 409, anonimleştirme ve e-posta yok", async () => {
  setup({ orders: [{ status: "PENDING", cancelReturnStatus: null }] });
  const res = await patch({ id: "r1", action: "approve" });
  assert.equal(res.status, 409);
  assert.equal(st.writes.length, 0);
  assert.equal(globalThis.__mails.length, 0);
});

test("yönetici hesabı bu yolla silinemez: 403, yazma ve e-posta yok", async () => {
  setup({ role: "ADMIN" });
  assert.equal((await patch({ id: "r1", action: "approve" })).status, 403);
  assert.equal(st.writes.length, 0);
  assert.equal(globalThis.__mails.length, 0);
});

// KALAN KAYNAK DENETİMİ: arayüz bileşeni ve admin sayfa bağlantısı React bileşeni olduğu için dışarıdan çalıştırılamaz.
test("[kaynak] arayüz: sayfa içi ConfirmDialog, yerel confirm/alert yok; sayfaya yalnızca bağlanır", () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const ui = read("components/AdminAccountDeletions.tsx");
  assert.match(ui, /ConfirmDialog/);
  assert.doesNotMatch(ui, /\bconfirm\(|window\.confirm|\balert\(/);
  const page = read("app/admin/page.tsx");
  assert.match(page, /<AdminAccountDeletions \/>/);
  assert.match(page, /id: "hesap-silme"/);
});
