import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { copyBatch, copyPath, sourcesOf, isTrendyolUrl } from "../lib/image-copy.ts";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const T = (n) => `https://cdn.dsmcdn.com/ty/${n}.jpg`;
const BLOB = "https://x.public.blob.vercel-storage.com/";
const prod = (id, images, extra = {}) => ({ id, images, imageUrl: null, variations: [], ...extra });

/** Ortak sahte veritabanı. dar=true: gerçek depo gibi (partinin ürünleri + veritabanında sayım, syncSnapshot yok); dar=false: eski tam liste. */
function fakeStore(products, dar) {
  const rows = new Map(products.map((p) => [p.id, structuredClone(p)]));
  const all = () => [...rows.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  const store = {
    rows,
    reads: [],
    async list(opts) {
      const atla = new Set(opts?.atla ?? []);
      const out = dar ? all().filter((p) => sourcesOf(p).some((u) => !atla.has(u))).slice(0, opts.limit) : all();
      store.reads.push(out.length);
      return out.map((p) => structuredClone(p));
    },
    async apply(plan) {
      const r = rows.get(plan.id);
      if (JSON.stringify(r.images) !== JSON.stringify(plan.oldImages) || r.imageUrl !== plan.oldImageUrl) return false;
      r.images = plan.newImages;
      r.imageUrl = plan.newImageUrl;
      r.map = { ...(r.map ?? {}), ...plan.imageMap }; // gerçek depo: veritabanındaki güncel imageMap ile birleştirir
      for (const v of plan.variations) r.variations.find((x) => x.id === v.id).images = v.next;
      return true;
    },
  };
  if (dar) {
    store.count = async (atla) => {
      const set = new Set(all().flatMap(sourcesOf));
      return { kalan: set.size, sirada: [...set].filter((u) => !atla.includes(u)).length };
    };
  }
  return store;
}
const deps = (over = {}) => {
  let t = 0;
  return { fetchImage: async () => Buffer.from("s"), process: async () => ({ big: Buffer.from("B"), small: Buffer.from("K") }), blob: { put: async (p) => BLOB + p }, now: () => (t += 1), ...over };
};
const catalog = () => [
  prod("a", [T(1), T(2), T(3)]),
  prod("b", [BLOB + "zaten-b.webp"]), // bekleyeni yok
  prod("c", [T(4)], { imageUrl: T(4), variations: [{ id: "v1", images: [T(5), T(4)] }] }),
  prod("d", [T(6), T(7)]),
  prod("e", [T(8)]),
];

async function runAll(dar, over) {
  const store = fakeStore(catalog(), dar);
  const failed = new Set();
  const log = [];
  for (let i = 0; i < 20; i++) {
    const r = await copyBatch(store, deps(over), { atla: failed });
    for (const h of r.hatalar) failed.add(h.url);
    log.push({ kopyalanan: r.kopyalanan, kalan: r.kalan, sirada: r.sirada, yazma: r.yazma, hata: r.hatalar.map((h) => h.url), atlanan: r.atlananUrun });
    if (r.sirada === 0) break;
  }
  return { store, log };
}

test("dar depo (partinin ürünleri + veritabanında sayım) tam listeyle AYNI parti sonuçlarını ve aynı son durumu üretir", async () => {
  const full = await runAll(false);
  const narrow = await runAll(true);
  assert.deepEqual(narrow.log, full.log);
  assert.deepEqual([...narrow.store.rows.values()].map((p) => [p.images, p.imageUrl, p.variations]), [...full.store.rows.values()].map((p) => [p.images, p.imageUrl, p.variations]));
  assert.equal(narrow.log.at(-1).kalan, 0);
  assert.ok([...narrow.store.rows.values()].every((p) => sourcesOf(p).length === 0), "hiç Trendyol adresi kalmadı");
});

test("hata veren görsel: iki depo da aynı ilerler, döngü takılmaz", async () => {
  const over = { fetchImage: async (u) => { if (u === T(2) || u === T(8)) throw new Error("timeout"); return Buffer.from("s"); } };
  const full = await runAll(false, over);
  const narrow = await runAll(true, over);
  assert.deepEqual(narrow.log, full.log);
  assert.equal(narrow.log.at(-1).kalan, 2);
  assert.equal(narrow.log.at(-1).sirada, 0);
});

test("dar depo parti başına en çok 4 ürün okur; tam liste her partide tüm kataloğu okurdu", async () => {
  const full = await runAll(false);
  const narrow = await runAll(true);
  assert.ok(full.store.reads.every((n) => n === 5));
  assert.ok(narrow.store.reads.every((n) => n <= 4), JSON.stringify(narrow.store.reads));
  assert.ok(narrow.store.reads.reduce((a, b) => a + b, 0) < full.store.reads.reduce((a, b) => a + b, 0));
});

test("imageMap: plana yalnızca bu partide kopyalananlar girer (eski kayıtla birleştirme veritabanında)", async () => {
  const store = fakeStore([prod("a", [T(1)])], true);
  store.rows.get("a").map = { [T(99)]: BLOB + "eski-b.webp" };
  await copyBatch(store, deps());
  assert.deepEqual(store.rows.get("a").map, { [T(99)]: BLOB + "eski-b.webp", [T(1)]: BLOB + copyPath("a", T(1), "b") });
});

test("gerçek depo: syncSnapshot okunmaz, yalnızca partinin ürünleri, sayım SQL'de, desen çekirdekle aynı", () => {
  const s = src("lib/image-copy-store.ts");
  const list = s.slice(s.indexOf("async list("), s.indexOf("async count("));
  assert.ok(!/syncSnapshot/.test(list), "liste syncSnapshot okumaz");
  assert.match(list, /ORDER BY p\."id" LIMIT \$\{opts\.limit\}/);
  assert.match(list, /NOT \(s\.u = ANY\(\$\{opts\.atla\}::text\[\]\)\)/);
  assert.match(list, /where: \{ id: \{ in: ids\.map\(\(r\) => r\.id\) \} \}/);
  assert.match(s, /count\(DISTINCT s\.u\)::int AS "kalan"/);
  const m = /TRENDYOL_SQL_RE = String\.raw`([^`]+)`/.exec(s);
  assert.ok(m);
  const re = new RegExp(m[1], "i"); // PostgreSQL ~* ile aynı anlam
  for (const u of [T(1), "https://dsmcdn.com/x.jpg", "HTTPS://CDN.DSMCDN.COM/x.jpg", "https://a.b.dsmcdn.com/x"]) assert.equal(re.test(u), isTrendyolUrl(u), u);
  for (const u of ["https://evil-dsmcdn.com/x", "https://dsmcdn.com.evil.com/x", "http://cdn.dsmcdn.com/x", "https://cdnXdsmcdnYcom/x", BLOB + "a-b.webp", "/api/product-images/x"]) {
    assert.equal(re.test(u), false, u);
    assert.equal(isTrendyolUrl(u), false, u);
  }
});

test("vitrin yenilemesi her partide değil, döngü sonunda bir kez", () => {
  const route = src("app/api/admin/gorsel-kopyala/route.ts");
  assert.equal((route.match(/revalidateStorefront\(\)/g) ?? []).length, 1);
  assert.match(route, /if \(body\?\.bitir === true\) \{\s*revalidateStorefront\(\);\s*return NextResponse\.json\(\{ success: true, yenilendi: true \}\);/);
  assert.ok(route.indexOf("adminGuard()") < route.indexOf("bitir === true"), "yenileme de yönetici oturumu ister");
  const ui = src("components/AdminImageCopy.tsx");
  const loop = ui.slice(ui.indexOf("while (!stop.current)"), ui.indexOf("} finally {"));
  assert.ok(!/bitir/.test(loop), "döngü içinde yenileme çağrısı yok");
  assert.match(ui.slice(ui.indexOf("} finally {")), /if \(ok > 0\) await fetch\("\/api\/admin\/gorsel-kopyala", \{[^}]*\}, body: JSON\.stringify\(\{ bitir: true \}\) \}\)/);
});
