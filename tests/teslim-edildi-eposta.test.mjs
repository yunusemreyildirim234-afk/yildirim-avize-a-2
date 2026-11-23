import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";

register("./_hooks-otomatik-kargo.mjs", import.meta.url);

const { markDelivered } = await import("../lib/shipment-sync.ts");
const { announceDeliveredEmail, shouldEmailDelivered } = await import("../lib/mark-delivered.ts");
const { creationFailWarning, creationFailReasonOf } = await import("../lib/creation-fail.ts");

const NOW = new Date("2026-11-23T12:00:00Z");
function setup(over = {}, userOver = {}) {
  const o = { id: "abcdef12-0000", userId: "u1", status: "SHIPPED", shippingType: "STANDART_KARGO", cancelReturnStatus: null, createdAt: new Date("2026-11-10T10:00:00Z"), ...over };
  const user = { email: "e2e-x@example.invalid", name: "Müşteri", ...userOver };
  const ok = (w) =>
    Object.entries(w).every(([k, v]) => {
      if (k === "OR") return v.some(ok);
      if (v && typeof v === "object" && "not" in v) return o[k] !== v.not;
      return o[k] === v;
    });
  globalThis.__fakePrisma = {
    order: {
      updateMany: async ({ where, data }) => {
        await Promise.resolve();
        if (!ok(where)) return { count: 0 };
        Object.assign(o, data);
        return { count: 1 };
      },
      findUnique: async () => ({ ...o, user: user.email === null ? null : user, items: [{ productTitle: "Kristal Avize", variation: { product: { id: "p1-uuid", title: "Kristal Avize" } } }] }),
    },
  };
  const sent = [];
  const deps = { email: async (d) => void sent.push(d) || true, now: () => NOW };
  return { o, sent, deps };
}

test("ilk geçişte tek e-posta (ürün + yorum bağlantısı verisiyle)", async () => {
  const { o, sent, deps } = setup();
  assert.equal(await markDelivered(o.id, {}, deps), true);
  assert.equal(o.status, "DELIVERED");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].orderId, o.id);
  assert.equal(sent[0].items[0].title, "Kristal Avize");
  assert.equal(sent[0].items[0].product.id, "p1-uuid");
});

test("aynı olay iki kez (eşzamanlı dahil) → tek e-posta", async () => {
  const { o, sent, deps } = setup();
  const [a, b] = await Promise.all([markDelivered(o.id, {}, deps), markDelivered(o.id, {}, deps)]);
  assert.equal([a, b].filter(Boolean).length, 1);
  assert.equal(await markDelivered(o.id, {}, deps), false);
  assert.equal(sent.length, 1);
});

test("30 günden eski sipariş → durum güncellenir, e-posta yok", async () => {
  const { o, sent, deps } = setup({ createdAt: new Date("2026-09-01T10:00:00Z") });
  assert.equal(await markDelivered(o.id, {}, deps), true);
  assert.equal(o.status, "DELIVERED");
  assert.equal(sent.length, 0);
});

test("mağazadan teslim → e-posta yok", async () => {
  const { o, sent, deps } = setup({ shippingType: "BEYOGLU_MAGAZA_TESLIM" });
  await markDelivered(o.id, {}, deps);
  assert.equal(sent.length, 0);
  assert.equal(shouldEmailDelivered({ shippingType: "STANDART_KARGO", createdAt: new Date(NOW.getTime() - 30 * 86_400_000) }, NOW), true);
});

test("iptal edilmiş sipariş → değişiklik ve e-posta yok", async () => {
  const { o, sent, deps } = setup({ status: "CANCELLED" });
  assert.equal(await markDelivered(o.id, {}, deps), false);
  assert.equal(o.status, "CANCELLED");
  assert.equal(sent.length, 0);
});

test("e-posta adresi yok / gönderim hatası → hata fırlatmaz", async () => {
  const a = setup({}, { email: null });
  assert.equal(await announceDeliveredEmail(a.o.id, a.deps), false);
  const b = setup();
  const boom = { ...b.deps, email: async () => { throw new Error("resend down"); } };
  assert.equal(await markDelivered(b.o.id, {}, boom), true);
  assert.equal(b.o.status, "DELIVERED");
});

test("e-posta konusu ≤ 60 karakter; Kargonomi bloğu yok", () => {
  const src = readFileSync(new URL("../lib/email.ts", import.meta.url), "utf8");
  const m = src.match(/sendDeliveredEmail[^]*?subject: `([^`]*)`/);
  assert.ok(m);
  assert.ok(m[1].replace("${code}", "abcdef12").length <= 60);
  assert.doesNotMatch(src.match(new RegExp("sendDeliveredEmail[^]*?" + "\\r?\\n}" + "\\r?\\n"))[0], /kargonomi/i);
});

test("order-status manuel DELIVERED e-posta göndermez (davranış değişmedi)", () => {
  const src = readFileSync(new URL("../app/api/admin/order-status/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /sendDeliveredEmail|announceDeliveredEmail/);
});

test("creation_fail_reason: dolu, boş, çok uzun", () => {
  assert.equal(creationFailWarning("Adres hatalı"), "Kargonomi gönderiyi oluşturamadı: Adres hatalı");
  assert.equal(creationFailWarning(""), null);
  assert.equal(creationFailWarning("   "), null);
  assert.equal(creationFailWarning(undefined), null);
  assert.equal(creationFailWarning(null), null);
  const long = creationFailWarning("x".repeat(500));
  assert.equal(long, `Kargonomi gönderiyi oluşturamadı: ${"x".repeat(200)}…`);
  assert.equal(creationFailReasonOf({ creation_fail_reason: " neden " }), "neden");
  assert.equal(creationFailReasonOf({ creation_fail_reason: null }), undefined);
  assert.equal(creationFailReasonOf({}), undefined);
  assert.equal(creationFailReasonOf(undefined), undefined);
});
