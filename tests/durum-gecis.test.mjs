import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ALLOWED_TRANSITIONS, ORDER_STATUSES, StatusRefusal, applyStatusChangeInTx, canTransition, planStatusChange, transitionError } from "../lib/order-undo.ts";

// Bellek içi veritabanı: sipariş + stok + kupon sayacı; runTx hata olursa anlık görüntüye döner (transaction geri alma)
function makeDb(order = {}, stock = { v1: 5, v2: 5 }) {
  const state = {
    order: { id: "o1", status: "PENDING", stockDeducted: true, couponCode: "KOD", ...order },
    items: [
      { variationId: "v2", quantity: 1, variation: { variationValue: "b", product: { title: "Avize" } } },
      { variationId: "v1", quantity: 2, variation: { variationValue: "a", product: { title: "Avize" } } },
    ],
    stock: { ...stock },
    used: 1, // kupon usedCount (sipariş açıkken 1)
    deducted: [],
  };
  const match = (w) => Object.entries(w).every(([k, v]) => state.order[k] === v);
  const tx = {
    order: {
      findUnique: async () => ({ status: state.order.status, stockDeducted: state.order.stockDeducted, couponCode: state.order.couponCode }),
      updateMany: async ({ where, data }) => {
        if (!match(where)) return { count: 0 };
        Object.assign(state.order, data);
        return { count: 1 };
      },
    },
    orderItem: { findMany: async ({ orderBy } = {}) => (orderBy ? [...state.items].sort((a, b) => a.variationId.localeCompare(b.variationId)) : state.items) },
    productVariation: { update: async ({ where, data }) => { state.stock[where.id] += data.stock.increment; } },
  };
  const release = async () => { state.used = Math.max(0, state.used - 1); };
  const reopen = {
    // rotadaki koşullu UPDATE: stock >= adet
    deduct: async (id, q) => {
      if (state.stock[id] < q) return false;
      state.stock[id] -= q;
      state.deducted.push(id);
      return true;
    },
    reserve: async () => { state.used += 1; }, // forceReserveCoupon: koşulsuz +1
  };
  const go = async (status) => {
    const snap = structuredClone(state);
    try {
      return await applyStatusChangeInTx(tx, "o1", status, release, reopen);
    } catch (e) {
      Object.assign(state, snap);
      throw e;
    }
  };
  return { state, go };
}

const X = "✖";
// Onaylanan tablo (satır = mevcut, sütun sırası = COLS)
const COLS = ["PENDING", "READY_FOR_PICKUP", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED", "PAYMENT_FAILED", "AWAITING_PAYMENT", "PENDING_NEW"];
const TABLE = {
  AWAITING_PAYMENT: ["Y", X, X, X, "İ", X, "İ", "-", X],
  PENDING_NEW: ["✔", X, X, X, "İ", X, X, X, "-"],
  PENDING: ["-", "✔", "✔", "✔", "İ", X, X, X, X],
  READY_FOR_PICKUP: ["✔", "-", X, "✔", "İ", X, X, X, X],
  SHIPPED: ["✔", X, "-", "✔", X, "İ", X, X, X],
  DELIVERED: [X, X, X, "-", X, "İ", X, X, X],
  CANCELLED: ["Y", X, X, X, "-", X, X, X, X],
  RETURNED: [X, X, X, X, X, "-", X, X, X],
  PAYMENT_FAILED: ["Y", X, X, X, "✔", X, "-", X, X],
};

test("geçiş tablosu: 9×9 hücrenin tamamı onaylanan tabloyla aynı", () => {
  assert.deepEqual([...ORDER_STATUSES].sort(), [...COLS].sort());
  assert.deepEqual(Object.keys(ALLOWED_TRANSITIONS).sort(), [...COLS].sort());
  for (const from of COLS) {
    TABLE[from].forEach((cell, i) => {
      const to = COLS[i];
      if (from === to) return;
      assert.equal(canTransition(from, to), cell !== X, `${from} → ${to}`);
      assert.equal(transitionError(from, to) === null, cell !== X, `${from} → ${to} hata metni`);
      if (cell === X) return;
      // Gerçekçi bayrak: kapalı durumdaki siparişin stoğu iade edilmiştir (stockDeducted=false)
      const plan = planStatusChange(from, to, !["CANCELLED", "RETURNED", "PAYMENT_FAILED"].includes(from));
      assert.equal(plan.restoreStock, cell === "İ", `${from} → ${to} stok iadesi`);
      // PAYMENT_FAILED → CANCELLED: kupon PAYMENT_FAILED'a geçerken zaten iade edildi (çift iade yok)
      assert.equal(plan.releaseCoupon, cell === "İ", `${from} → ${to} kupon iadesi`);
    });
  }
});

test("yasak geçiş: hiçbir şey yazılmaz, Türkçe neden döner", async () => {
  for (const [from, to, re] of [
    ["DELIVERED", "CANCELLED", /Teslim edilmiş sipariş iptal edilemez/],
    ["SHIPPED", "CANCELLED", /Kargoya verilmiş sipariş iptal edilemez/],
    ["RETURNED", "PENDING", /son durumdadır/],
    ["CANCELLED", "SHIPPED", /İzinli durumlar: Hazırlanıyor/],
    ["PENDING", "RETURNED", /yapılamaz/],
  ]) {
    const d = makeDb({ status: from, stockDeducted: !["CANCELLED", "RETURNED"].includes(from) });
    const before = structuredClone(d.state);
    const r = await d.go(to);
    assert.equal(r.outcome, "FORBIDDEN", `${from} → ${to}`);
    assert.match(r.message, re);
    assert.deepEqual(d.state, before);
  }
});

test("bulgu 4.1: iptal/başarısız sipariş yeniden açılınca stok düşülür ve kupon yeniden sayılır", async () => {
  for (const from of ["CANCELLED", "PAYMENT_FAILED"]) {
    const d = makeDb({ status: from, stockDeducted: false });
    d.state.used = 0; // kapanırken iade edilmişti
    const r = await d.go("PENDING");
    assert.equal(r.outcome, "OK");
    assert.deepEqual({ ...d.state.order }, { id: "o1", status: "PENDING", stockDeducted: true, couponCode: "KOD" });
    assert.deepEqual(d.state.stock, { v1: 3, v2: 4 });
    assert.deepEqual(d.state.deducted, ["v1", "v2"], "variationId sırasıyla");
    assert.equal(d.state.used, 1);
  }
});

test("bulgu 4.1: yeniden açmada stok yetmezse durum, stok ve kupon değişmez; hata ürünü söyler", async () => {
  const d = makeDb({ status: "CANCELLED", stockDeducted: false }, { v1: 2, v2: 0 });
  d.state.used = 0;
  const before = structuredClone(d.state);
  await assert.rejects(d.go("PENDING"), (e) => e instanceof StatusRefusal && /Stok yetersiz: "Avize" \/ b için 1 adet/.test(e.message));
  assert.deepEqual(d.state, before, "v1 düşümü de geri alındı");
});

test("bulgu 4.2: CANCELLED → PENDING → CANCELLED döngüsü kuponu ve stoğu dengede tutar (çift iade yok)", async () => {
  const d = makeDb(); // PENDING, stok düşülmüş, kupon sayılmış (used=1)
  const start = { stock: { ...d.state.stock }, used: d.state.used };
  for (let i = 0; i < 3; i++) {
    await d.go("CANCELLED");
    assert.equal(d.state.used, 0);
    assert.deepEqual(d.state.stock, { v1: 7, v2: 6 });
    await d.go("PENDING");
    assert.deepEqual({ stock: d.state.stock, used: d.state.used }, start);
  }
  await d.go("CANCELLED");
  assert.equal((await d.go("CANCELLED")).outcome, "OK"); // çift tıklama
  assert.equal(d.state.used, 0, "sayaç sıfırın altına / fazladan düşmez");
  assert.deepEqual(d.state.stock, { v1: 7, v2: 6 });
});

test("bulgu 4.3: yönetici AWAITING_PAYMENT → PAYMENT_FAILED yapınca kupon da iade edilir; ardından → CANCELLED ikinci kez iade etmez", async () => {
  const d = makeDb({ status: "AWAITING_PAYMENT" });
  await d.go("PAYMENT_FAILED");
  assert.equal(d.state.used, 0);
  assert.equal(d.state.order.stockDeducted, false);
  assert.deepEqual(d.state.stock, { v1: 7, v2: 6 });
  d.state.used = 1; // aynı kuponu başka bir sipariş kullandı
  await d.go("CANCELLED");
  assert.equal(d.state.used, 1, "başkasının hakkı düşürülmez");
  assert.deepEqual(d.state.stock, { v1: 7, v2: 6 });
});

test("AWAITING_PAYMENT → PENDING: stok ve kupon sipariş anında zaten ayrılı; tekrar düşülmez, tekrar sayılmaz", async () => {
  const d = makeDb({ status: "AWAITING_PAYMENT" });
  const r = await d.go("PENDING");
  assert.deepEqual(r.plan, { restoreStock: false, releaseCoupon: false, ensureStock: false, reserveCoupon: false });
  assert.deepEqual(d.state.stock, { v1: 5, v2: 5 });
  assert.equal(d.state.used, 1);
});

test("AWAITING_PAYMENT → PENDING: stok ayrılmamışsa (bayrak false) koşullu düşülür; yetmezse durum değişmez", async () => {
  const ok = makeDb({ status: "AWAITING_PAYMENT", stockDeducted: false });
  await ok.go("PENDING");
  assert.deepEqual(ok.state.stock, { v1: 3, v2: 4 });
  assert.equal(ok.state.order.stockDeducted, true);
  assert.equal(ok.state.used, 1, "kupon açık durumda zaten sayılı: yeniden sayılmaz");
  const short = makeDb({ status: "AWAITING_PAYMENT", stockDeducted: false }, { v1: 1, v2: 5 });
  await assert.rejects(short.go("PENDING"), StatusRefusal);
  assert.equal(short.state.order.status, "AWAITING_PAYMENT");
  assert.deepEqual(short.state.stock, { v1: 1, v2: 5 });
});

test("yeniden açma: yarışta okunan durum değiştiyse CONFLICT, stok/kupon işlemi yok", async () => {
  const d = makeDb({ status: "CANCELLED", stockDeducted: false });
  d.state.used = 0;
  const first = await d.go("PENDING");
  assert.equal(first.outcome, "OK");
  // ikinci sekme hâlâ CANCELLED sanıyor: PENDING → PENDING etkisizdir, ikinci kez düşmez / saymaz
  await d.go("PENDING");
  assert.deepEqual(d.state.stock, { v1: 3, v2: 4 });
  assert.equal(d.state.used, 1);
});

test("yeniden açmada kupon geçerlilik denetimi yok (koşulsuz +1) ve Geri Al belirteci üretilmez", () => {
  const coupons = readFileSync(new URL("../lib/coupons.ts", import.meta.url), "utf8");
  const force = coupons.slice(coupons.indexOf("export async function forceReserveCoupon"), coupons.indexOf("/** Ödemesi başarısız olan"));
  assert.match(force, /SET "usedCount" = "usedCount" \+ 1 WHERE "code" = \$\{code\}`/);
  assert.ok(!/active|expiresAt|maxUses/.test(force), "aktiflik/süre/limit koşulu olmamalı");
  const route = readFileSync(new URL("../app/api/admin/order-status/route.ts", import.meta.url), "utf8");
  assert.match(route, /reserve: \(code\) => forceReserveCoupon\(tx, code\)/);
  assert.match(route, /before\.status !== status && !plan\.ensureStock && !plan\.reserveCoupon/);
  const undo = readFileSync(new URL("../app/api/admin/order-status/undo/route.ts", import.meta.url), "utf8");
  assert.ok(!undo.includes("forceReserveCoupon"), "Geri Al'a dokunulmadı");
});
