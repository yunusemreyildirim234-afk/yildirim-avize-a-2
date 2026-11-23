import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

// DAVRANIŞ: fatura ucu GERÇEK kodla çalışır (sahte depo ve e-posta). Kural: yükleme akışında yazılan fatura Neon'dan geri okunmaz,
// e-posta bellekteki PDF ile gider (tek yazma, sıfır geri okuma); yeniden gönderim (PATCH) ise veritabanından okur.
register("./_hooks-davranis.mjs", import.meta.url);
const route = await import("../app/api/admin/orders/[id]/invoice/route.ts");

let calls;
function setup({ status = "DELIVERED", email = "musteri+misafirab12@example.com", stored = null } = {}) {
  calls = { upsert: [], invoiceFind: 0, update: [], orderFind: [] };
  globalThis.__mails = [];
  globalThis.__adminAuthed = true;
  globalThis.__fakePrisma = {
    order: { findUnique: async (a) => (calls.orderFind.push(a), { id: "o1", status, user: { name: "Ali", email } }) },
    orderInvoice: {
      upsert: async (a) => (calls.upsert.push(a), {}),
      findUnique: async () => (calls.invoiceFind++, stored),
      update: async (a) => (calls.update.push(a), {}),
    },
  };
}
const ctx = { params: Promise.resolve({ id: "o1" }) };
const ip = () => ({ "x-forwarded-for": `ip-${Math.random()}` });
const pdfBytes = Buffer.from("%PDF-1.4 test icerik");
const upload = (bytes = pdfBytes, type = "application/pdf") => {
  const fd = new FormData();
  fd.set("file", new File([bytes], "fatura 1.pdf", { type }));
  return route.POST(new Request("http://x/inv", { method: "POST", body: fd, headers: ip() }), ctx);
};

test("yükleme: tek upsert, faturanın veritabanından geri okuması YOK, e-posta bellekteki PDF ile gider", async () => {
  setup();
  const res = await upload();
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { success: true, emailed: true });
  assert.equal(calls.upsert.length, 1);
  assert.equal(calls.invoiceFind, 0, "yazılan fatura geri okunmadı");
  assert.equal(globalThis.__mails.length, 1);
  assert.deepEqual(globalThis.__mails[0].pdf, pdfBytes);
  assert.equal(globalThis.__mails[0].to, "musteri@example.com", "misafir etiketi temizlenir");
  assert.equal(globalThis.__mails[0].orderId, "o1");
  assert.equal(calls.update.length, 1, "gönderim sonrası emailSentAt işaretlenir");
  assert.ok(calls.update[0].data.emailSentAt instanceof Date);
});

test("yükleme doğrulamaları: teslim edilmemiş 409, PDF olmayan 400; hiçbirinde yazma/e-posta yok", async () => {
  setup({ status: "PENDING" });
  assert.equal((await upload()).status, 409);
  setup();
  assert.equal((await upload(pdfBytes, "image/png")).status, 400);
  assert.equal((await upload(Buffer.from("PDF degil icerik"))).status, 400);
  assert.equal(calls.upsert.length, 0);
  assert.equal(globalThis.__mails.length, 0);
});

test("yetkisiz yükleme 401: depoya dokunulmaz", async () => {
  setup();
  globalThis.__adminAuthed = false;
  assert.equal((await upload()).status, 401);
  assert.equal(calls.upsert.length, 0);
  assert.equal(calls.orderFind.length, 0);
});

test("yeniden gönderim (PATCH) hâlâ veritabanından okur ve kayıtlı PDF'i yollar", async () => {
  const data = Buffer.from("%PDF-1.7 kayitli");
  setup({ stored: { orderId: "o1", fileName: "kayitli.pdf", data } });
  const res = await route.PATCH(new Request("http://x/inv", { method: "PATCH", headers: ip() }), { params: Promise.resolve({ id: `o-${Math.random()}` }) });
  assert.equal(res.status, 200);
  assert.ok(calls.invoiceFind >= 1, "PATCH veritabanından okur");
  assert.equal(globalThis.__mails.length, 1);
  assert.deepEqual(globalThis.__mails[0].pdf, data);
  assert.equal(globalThis.__mails[0].fileName, "kayitli.pdf");
});
