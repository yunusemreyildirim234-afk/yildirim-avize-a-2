import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../app/api/admin/orders/[id]/invoice/route.ts", import.meta.url), "utf8");
const post = src.slice(src.indexOf("export async function POST"), src.indexOf("export async function PATCH"));

test("fatura yükleme: yazılan fatura Neon'dan geri okunmaz, bellekteki PDF ile e-posta gider", () => {
  assert.match(post, /orderInvoice\.upsert/);
  assert.match(post, /emailInvoice\(id, \{ fileName, pdf: data, user: order\.user \}\)/);
  assert.doesNotMatch(post, /findUnique\(\{ where: \{ orderId/);
  // yeniden gönderim (PATCH) hâlâ veritabanından okur
  assert.match(src, /if \(!loaded\) \{[\s\S]*orderInvoice\.findUnique/);
});
