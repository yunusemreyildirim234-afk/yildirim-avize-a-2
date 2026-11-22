import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_alias.mjs";

const { decideRegenerate, regenerateBlockedMessage, REGENERATE_ALLOWED_STATUSES } = await import("../lib/regenerate-guard.ts");

const linked = { kargonomiShipmentId: 55 };
const withStatus = (s) => {
  const calls = { n: 0 };
  return { calls, refresh: async () => (calls.n++, { kargonomiStatus: s }) };
};

test("taslak gönderi: yeniden üretir", async () => {
  const m = withStatus("draft");
  assert.deepEqual(await decideRegenerate(linked, true, m.refresh), { action: "proceed" });
  assert.equal(m.calls.n, 1);
});

test("iptal edilmiş gönderi: yeniden üretir", async () => {
  assert.deepEqual(await decideRegenerate(linked, true, withStatus("cancelled").refresh), { action: "proceed" });
});

test("aktif/onaylı gönderi: 409 mesajı, yeni gönderi açılmaz", async () => {
  for (const s of ["ready", "webservice_shipment_started", "webservice_shipment_delivered"]) {
    const d = await decideRegenerate(linked, true, withStatus(s).refresh);
    assert.deepEqual(d, { action: "blocked", message: regenerateBlockedMessage(s) }, s);
  }
  assert.equal(regenerateBlockedMessage("ready"), "Mevcut gönderi aktif görünüyor (Kargonomi durumu: ready). Önce Kargonomi panelinden iptal et, sonra 'Durumu Yenile'ye bas, ardından yeniden üret.");
});

test("bilinmeyen / boş durum: aktif sayılır (güvenli taraf)", async () => {
  for (const s of ["canceled_by_carrier", "xyz", "", null]) {
    const d = await decideRegenerate(linked, true, withStatus(s).refresh);
    assert.equal(d.action, "blocked", String(s));
    assert.ok(d.message.includes(`durumu: ${s || "boş"})`), String(s)); // ham değer mesajda
  }
  assert.deepEqual([...REGENERATE_ALLOWED_STATUSES], ["draft", "cancelled"]);
});

test("bağlı gönderi yok veya yeniden üretme isteği değil: normal akış, yenileme çağrılmaz", async () => {
  const m = withStatus("ready");
  assert.deepEqual(await decideRegenerate({ kargonomiShipmentId: null }, true, m.refresh), { action: "proceed" });
  assert.deepEqual(await decideRegenerate(linked, false, m.refresh), { action: "proceed" });
  assert.equal(m.calls.n, 0);
});

test("yenileme hata fırlatırsa karar hata fırlatır (yeni gönderi açılmaz)", async () => {
  await assert.rejects(() => decideRegenerate(linked, true, async () => { throw new Error("ağ"); }), /ağ/);
});

test("uç: karar claim'den önce uygulanır, 409 döner; zorla bayrağı yok", () => {
  const r = readFileSync(new URL("../app/api/admin/orders/[id]/create-shipping/route.ts", import.meta.url), "utf8");
  const g = r.indexOf("decideRegenerate(");
  assert.ok(g > 0 && g < r.indexOf("createShippingOnce({"));
  assert.match(r, /guard\.action === "blocked"\) return NextResponse\.json\(\{ error: guard\.message \}, \{ status: 409 \}\)/);
  assert.doesNotMatch(r, /force/i);
});
