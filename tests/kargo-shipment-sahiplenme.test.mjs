import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/admin/kargonomi/shipment/route.ts", import.meta.url), "utf8");
const post = route.slice(route.indexOf("export async function POST"), route.indexOf("export async function PATCH"));

test("A5: POST /api/admin/kargonomi/shipment Kargonomi'yi çağırmadan önce koşullu sahiplenir; kaybeden 409 alır; hata olursa bırakır", () => {
  const claim = post.indexOf("prisma.order.updateMany({ where: { id: orderId, kargonomiShipmentId: null, labelCreated: false }, data: { labelCreated: true } })");
  const call = post.indexOf("createShipmentForOrder(orderId)");
  assert.ok(claim > 0 && call > claim, "sahiplenme, Kargonomi çağrısından önce");
  assert.match(post, /claim\.count === 0/);
  assert.match(post, /status: 409/);
  assert.match(post, /zaten oluşturuluyor/);
  assert.match(post, /status: 404/);
  // hata → sahiplenme geri bırakılır (yalnızca gönderi kimliği hâlâ boşsa), hata yeniden fırlatılır
  assert.match(post, /updateMany\(\{ where: \{ id: orderId, kargonomiShipmentId: null \}, data: \{ labelCreated: false \} \}\)/);
  assert.match(post, /throw error;/);
  assert.match(post, /adminGuard\(\)/);
});
