import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./_admin-hooks.mjs", import.meta.url);
const route = await import("../app/api/admin/product/complements/route.ts");

const P = (id, basePrice, over = {}) => ({ id, title: `Ürün ${id}`, active: true, basePrice, variations: [{ extraPrice: 0 }], ...over });
let products, links, writes;

function setup({ authed = true, prods = [P("A", 1000), P("B", 1000), P("C", 100), P("D", 50)], existing = [] } = {}) {
  globalThis.__adminAuthed = authed;
  globalThis.__revalidated = 0;
  products = prods;
  links = existing.map((l) => ({ position: 0, ...l }));
  writes = { createMany: [], updateMany: [], deleteMany: [] };
  globalThis.__fakePrisma = {
    product: { findMany: async ({ where }) => products.filter((p) => where.id.in.includes(p.id)) },
    productComplement: {
      findMany: async (args = {}) => {
        const w = args.where;
        if (!w) return links;
        if (w.OR) return links.filter((l) => w.OR.some((c) => (c.mainProductId?.in ?? []).includes(l.mainProductId) || (c.complementProductId?.in ?? []).includes(l.complementProductId)));
        return links.filter((l) => w.mainProductId.in.includes(l.mainProductId));
      },
      createMany: (a) => (writes.createMany.push(a), Promise.resolve({ count: a.data.length })),
      updateMany: (a) => (writes.updateMany.push(a), Promise.resolve({ count: 1 })),
      deleteMany: async (a) => (writes.deleteMany.push(a), { count: 3 }),
    },
    $transaction: async (ops) => Promise.all(ops),
  };
}
const post = (body) => route.POST(new Request("http://x/api/admin/product/complements", { method: "POST", body: JSON.stringify(body) }));
const add = (over = {}) => post({ action: "add", ids: ["A"], complementIds: ["C"], type: "PERCENT", value: 10, ...over });

test("oturumsuz: POST ve GET 401, hiçbir şey yazılmaz", async () => {
  setup({ authed: false });
  assert.equal((await add()).status, 401);
  assert.equal((await route.GET(new Request("http://x/api/admin/product/complements?ids=A"))).status, 401);
  assert.deepEqual(writes, { createMany: [], updateMany: [], deleteMany: [] });
});

test("değer sınırları: 0, negatif, NaN, metin, PERCENT >= 100, FIXED 3 ondalık → 400", async () => {
  setup();
  for (const [type, value] of [["PERCENT", 0], ["PERCENT", -5], ["PERCENT", 100], ["PERCENT", 150], ["FIXED", 0], ["FIXED", 1.234], ["PERCENT", "10"], ["PERCENT", null], ["X", 5]]) {
    assert.equal((await add({ type, value })).status, 400, `${type} ${value}`);
  }
  assert.equal(writes.createMany.length, 0);
  assert.equal((await add({ type: "PERCENT", value: 99.5 })).status, 200);
});

test("ekleme: yeni bağ oluşturulur, position sıradaki, tek createMany", async () => {
  setup({ existing: [{ mainProductId: "A", complementProductId: "D", discountType: "PERCENT", discountValue: 5, position: 3 }] });
  const res = await add({ complementIds: ["C"] });
  const j = await res.json();
  assert.equal(res.status, 200);
  assert.equal(j.created, 1);
  assert.equal(writes.createMany.length, 1);
  assert.deepEqual(writes.createMany[0].data, [{ mainProductId: "A", complementProductId: "C", discountType: "PERCENT", discountValue: 10, position: 4 }]);
  assert.equal(globalThis.__revalidated, 1);
});

test("dryRun hiçbir şey yazmaz ve vitrini yenilemez; sayıları verir", async () => {
  setup({ existing: [{ mainProductId: "A", complementProductId: "C", discountType: "PERCENT", discountValue: 5 }] });
  const j = await (await add({ ids: ["A", "B"], dryRun: true })).json();
  assert.equal(j.dryRun, true);
  assert.equal(j.created, 1); // B→C
  assert.equal(j.updated, 1); // A→C
  assert.deepEqual(writes, { createMany: [], updateMany: [], deleteMany: [] });
  assert.equal(globalThis.__revalidated, 0);
});

test("upsert: var olan çiftin indirimi güncellenir, yeni satır açılmaz", async () => {
  setup({ existing: [{ mainProductId: "A", complementProductId: "C", discountType: "PERCENT", discountValue: 5 }] });
  const j = await (await add({ value: 20 })).json();
  assert.equal(j.updated, 1);
  assert.equal(j.created, 0);
  assert.equal(writes.createMany.length, 0);
  assert.deepEqual(writes.updateMany[0], { where: { complementProductId: "C", mainProductId: { in: ["A"] } }, data: { discountType: "PERCENT", discountValue: 20 } });
});

test("FIXED indirim ürünün en düşük fiyatına eşit/üstüyse atlanır ve nedeni listelenir; diğerleri uygulanır", async () => {
  setup({ prods: [P("A", 1000), P("C", 100), P("D", 500, { variations: [{ extraPrice: 0 }, { extraPrice: 50 }] })] });
  const j = await (await add({ complementIds: ["C", "D"], type: "FIXED", value: 100 })).json();
  assert.equal(j.created, 1);
  assert.equal(j.skipped, 1);
  assert.match(j.skippedItems[0].reason, /fiyatını aşamaz/);
  assert.equal(writes.createMany[0].data[0].complementProductId, "D");
  // en düşük varyasyon fiyatı esas: 99,99 geçer, 100 geçmez
  setup({ prods: [P("A", 1000), P("C", 100, { variations: [{ extraPrice: 0 }, { extraPrice: 40 }] })] });
  assert.equal((await (await add({ type: "FIXED", value: 99.99 })).json()).created, 1);
});

test("ana = tamamlayıcı atlanır", async () => {
  setup();
  const j = await (await add({ ids: ["C"], complementIds: ["C"] })).json();
  assert.equal(j.created, 0);
  assert.match(j.skippedItems[0].reason, /kendisinin/);
});

test("zincir/döngü: ana ürün başka bağın tamamlayıcısıysa ya da tamamlayıcı başka bağın ana ürünüyse atlanır", async () => {
  setup({ existing: [{ mainProductId: "B", complementProductId: "A", discountType: "PERCENT", discountValue: 5 }] });
  let j = await (await add({ ids: ["A"], complementIds: ["C"] })).json(); // A zaten tamamlayıcı
  assert.equal(j.created, 0);
  assert.match(j.skippedItems[0].reason, /Zincir/);
  j = await (await add({ ids: ["D"], complementIds: ["B"] })).json(); // B zaten ana
  assert.equal(j.created, 0);
  assert.match(j.skippedItems[0].reason, /Zincir/);
});

test("zincir/döngü: aynı istekte hem ana hem tamamlayıcı seçilen ürün (A↔B) belirlenimli olarak atlanır", async () => {
  setup();
  let j = await (await post({ action: "add", ids: ["A", "B"], complementIds: ["A", "B"], type: "PERCENT", value: 10 })).json();
  assert.equal(j.created, 0);
  assert.equal(writes.createMany.length, 0);
  // yalnız örtüşmeyen çift geçer: A→C (A tamamlayıcı değil, C ana değil); B ana ve tamamlayıcı olduğundan hiçbir çifti geçmez
  setup();
  j = await (await post({ action: "add", ids: ["A", "B"], complementIds: ["B", "C"], type: "PERCENT", value: 10 })).json();
  assert.equal(j.created, 1);
  assert.deepEqual(writes.createMany[0].data.map((d) => `${d.mainProductId}>${d.complementProductId}`), ["A>C"]);
});

test("ana başına en çok 12 tamamlayıcı", async () => {
  const comps = Array.from({ length: 12 }, (_, i) => P(`K${i}`, 100));
  setup({ prods: [P("A", 1000), P("X", 100), ...comps], existing: comps.map((c) => ({ mainProductId: "A", complementProductId: c.id, discountType: "PERCENT", discountValue: 5 })) });
  const j = await (await add({ complementIds: ["X"] })).json();
  assert.equal(j.created, 0);
  assert.match(j.skippedItems[0].reason, /en fazla 12/);
  // 12 mevcut bağın güncellenmesi sınıra takılmaz
  const u = await (await add({ complementIds: ["K0"] })).json();
  assert.equal(u.updated, 1);
});

test("istek sınırları: 13 tamamlayıcı, 501 ana ürün, boş listeler → 400", async () => {
  setup();
  assert.equal((await add({ complementIds: Array.from({ length: 13 }, (_, i) => `c${i}`) })).status, 400);
  assert.equal((await add({ ids: Array.from({ length: 501 }, (_, i) => `m${i}`) })).status, 400);
  assert.equal((await add({ ids: [] })).status, 400);
  assert.equal((await add({ complementIds: [] })).status, 400);
  assert.equal((await post({ action: "x" })).status, 400);
  assert.equal((await route.GET(new Request(`http://x/a?ids=${Array.from({ length: 501 }, (_, i) => `m${i}`).join(",")}`))).status, 400);
});

test("pasif tamamlayıcı: bağ kurulur, uyarı verilir; fiyatsız tamamlayıcı atlanır", async () => {
  setup({ prods: [P("A", 1000), P("C", 100, { active: false }), P("D", 0)] });
  const j = await (await add({ complementIds: ["C", "D"] })).json();
  assert.equal(j.created, 1);
  assert.equal(j.warnings.length, 1);
  assert.equal(j.skipped, 1);
});

test("kaldırma: çiftlerle ve ids×complementIds ile; Geri Al jetonu/snapshot dönmez", async () => {
  setup();
  let j = await (await post({ action: "remove", pairs: [{ mainId: "A", complementId: "C" }] })).json();
  assert.equal(j.removed, 3);
  assert.deepEqual(writes.deleteMany[0], { where: { OR: [{ mainProductId: "A", complementProductId: "C" }] } });
  assert.equal("snapshot" in j || "undoToken" in j, false);
  await post({ action: "remove", ids: ["A"], complementIds: ["C", "D"] });
  assert.deepEqual(writes.deleteMany[1], { where: { mainProductId: { in: ["A"] }, complementProductId: { in: ["C", "D"] } } });
  assert.equal((await post({ action: "remove", pairs: [] })).status, 400);
  assert.equal((await post({ action: "remove", pairs: [{ mainId: 1 }] })).status, 400);
});

test("GET: seçili ürünlerin bağları ve tüm ana/tamamlayıcı kimlikleri; vitrin yenilenmez", async () => {
  setup({ existing: [{ id: "l1", mainProductId: "A", complementProductId: "C", discountType: "PERCENT", discountValue: 5 }, { id: "l2", mainProductId: "B", complementProductId: "D", discountType: "FIXED", discountValue: 5 }] });
  const res = await route.GET(new Request("http://x/api/admin/product/complements?ids=A"));
  const j = await res.json();
  assert.deepEqual(j.links.map((l) => l.id), ["l1"]);
  assert.deepEqual(j.mainIds.sort(), ["A", "B"]);
  assert.deepEqual(j.complementIds.sort(), ["C", "D"]);
  assert.equal(globalThis.__revalidated, 0);
});
