import test from "node:test";
import assert from "node:assert/strict";
import { withDbRetry, classifyDbError, isReadOperation } from "../lib/db-retry.ts";

// Gerçek biçimler (adapter-pg + pg-pool): düz Error mesajları ve Prisma kodları. Gerçek veritabanı yok.
const connectTimeout = () => new Error("timeout exceeded when trying to connect");
const connectTimeout2 = () => new Error("Connection terminated due to connection timeout", { cause: new Error("Connection terminated unexpectedly") });
const terminated = () => new Error("Connection terminated unexpectedly");
const withCode = (code, message = "x") => Object.assign(new Error(message), { code });

/** İlk `fails` çağrıda `err()` fırlatır, sonra "ok" döner; çağrı sayısını tutar. */
function flaky(fails, err) {
  const state = { calls: 0 };
  const run = async () => {
    state.calls++;
    if (state.calls <= fails) throw err();
    return "ok";
  };
  return { run, state };
}
const D = 1; // testte gecikme 1 ms

test("(a) okuma + bağlantı zaman aşımı → 2. denemede başarı", async () => {
  const { run, state } = flaky(1, connectTimeout);
  assert.equal(await withDbRetry(run, "findMany", D), "ok");
  assert.equal(state.calls, 2);
});

test("(a2) 'Connection terminated due to connection timeout' da bağlantı sınıfı", async () => {
  assert.equal(classifyDbError(connectTimeout2()), "connect");
  const { run, state } = flaky(1, connectTimeout2);
  assert.equal(await withDbRetry(run, "update", D), "ok");
  assert.equal(state.calls, 2);
});

test("(b) okuma + 'Connection terminated' → yeniden denenir (mesaj, P1017, cause zinciri)", async () => {
  for (const err of [terminated, () => withCode("P1017"), () => new Error("wrapper", { cause: terminated() })]) {
    const { run, state } = flaky(1, err);
    assert.equal(await withDbRetry(run, "findFirst", D), "ok");
    assert.equal(state.calls, 2);
  }
  for (const op of ["count", "aggregate", "groupBy", "$queryRaw", "findUnique"]) assert.equal(isReadOperation(op), true);
});

test("(c) yazma + 'Connection terminated' → ASLA yeniden denenmez, hata aynen döner", async () => {
  for (const op of ["create", "update", "delete", "upsert", "createMany", "updateMany", "deleteMany", "$executeRaw", "$executeRawUnsafe", "bilinmeyenIslem"]) {
    for (const err of [terminated, () => withCode("P1017")]) {
      const e = err();
      const state = { calls: 0 };
      await assert.rejects(
        withDbRetry(async () => { state.calls++; throw e; }, op, D),
        (got) => got === e,
      );
      assert.equal(state.calls, 1, op);
    }
  }
});

test("(d) yazma + bağlantı zaman aşımı / P1001 → 1 kez yeniden denenir", async () => {
  for (const err of [connectTimeout, connectTimeout2, () => withCode("P1001")]) {
    const { run, state } = flaky(1, err);
    assert.equal(await withDbRetry(run, "create", D), "ok");
    assert.equal(state.calls, 2);
  }
});

test("(e) iki deneme de düşerse ORİJİNAL (ilk) hata fırlatılır", async () => {
  const first = connectTimeout();
  let n = 0;
  await assert.rejects(
    withDbRetry(async () => { n++; throw n === 1 ? first : new Error("ikinci hata"); }, "findMany", D),
    (got) => got === first,
  );
  assert.equal(n, 2);
});

test("(f) alakasız hatalar yeniden denenmez (benzersizlik ihlali vb.)", async () => {
  for (const err of [() => withCode("P2002", "Unique constraint failed"), () => withCode("23505"), () => new Error("başka bir hata"), () => "metin", () => null]) {
    const e = err();
    const state = { calls: 0 };
    await assert.rejects(withDbRetry(async () => { state.calls++; throw e; }, "findMany", D), (got) => got === e);
    assert.equal(state.calls, 1);
  }
});

test("(g) yeniden deneme sayısı en fazla 1 (toplam 2 çağrı)", async () => {
  for (const op of ["findMany", "create"]) {
    const state = { calls: 0 };
    await assert.rejects(withDbRetry(async () => { state.calls++; throw connectTimeout(); }, op, D));
    assert.equal(state.calls, 2);
  }
});

test("başarılı çağrıda gecikme/yeniden deneme yok", async () => {
  const { run, state } = flaky(0, connectTimeout);
  assert.equal(await withDbRetry(run, "findMany", D), "ok");
  assert.equal(state.calls, 1);
});
