import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./_admin-hooks.mjs", import.meta.url);
const route = await import("../app/api/admin/complement-settings/route.ts");

let upserts, stored;
function setup(authed = true) {
  globalThis.__adminAuthed = authed;
  globalThis.__revalidated = 0;
  upserts = [];
  stored = undefined;
  globalThis.__fakePrisma = {
    siteConfig: {
      findUnique: async () => (stored === undefined ? null : { complementSuggestCount: stored }),
      upsert: async (a) => (upserts.push(a), {}),
    },
  };
}
const put = (body) => route.PUT(new Request("http://x/api/admin/complement-settings", { method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body) }));
const MSG = "Öneri sayısı 0 ile 12 arasında bir tam sayı olmalıdır (boş: 4).";

test("oturumsuz: GET ve PUT 401, yazma yok", async () => {
  setup(false);
  assert.equal((await route.GET()).status, 401);
  assert.equal((await put({ count: 4 })).status, 401);
  assert.equal(upserts.length, 0);
});

test("geçerli değerler: 0, 4, 12, '7' ve boş/null → varsayılan (null); upsert id 1", async () => {
  for (const [input, expected] of [[0, 0], [4, 4], [12, 12], ["7", 7], [null, null], ["", null]]) {
    setup();
    const res = await put({ count: input });
    assert.equal(res.status, 200, String(input));
    assert.equal((await res.json()).count, expected);
    assert.deepEqual(upserts[0], { where: { id: 1 }, create: { id: 1, complementSuggestCount: expected }, update: { complementSuggestCount: expected } });
  }
});

test("count alanı hiç yoksa varsayılana (null) döner", async () => {
  setup();
  assert.equal((await put({})).status, 200);
  assert.equal(upserts[0].update.complementSuggestCount, null);
});

test("geçersiz değerler: -1, 13, 2.5, 'x', '2.5', true, NaN → 400 ve Türkçe mesaj, yazma yok", async () => {
  for (const input of [-1, 13, 2.5, "x", "2.5", "-1", true, [4], {}]) {
    setup();
    const res = await put({ count: input });
    assert.equal(res.status, 400, JSON.stringify(input));
    assert.equal((await res.json()).error, MSG);
    assert.equal(upserts.length, 0);
  }
  setup();
  assert.equal((await put("{bozuk")).status, 400);
});

test("GET: kayıt yoksa null, kayıt varsa değer; vitrin yenilenmez, PUT yenileyip", async () => {
  setup();
  assert.deepEqual(await (await route.GET()).json(), { count: null, defaultCount: 4 });
  stored = 0;
  assert.equal((await (await route.GET()).json()).count, 0);
  assert.equal(globalThis.__revalidated, 0);
  await put({ count: 3 });
  assert.equal(globalThis.__revalidated, 1);
});
