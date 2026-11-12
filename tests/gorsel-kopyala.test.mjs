import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blobYolu, kaynakHash } from "../tools/gorsel/lib/cekirdek.mjs";
import { copyBatch, copyPath, buildWritePlan, sourcesOf, fetchTrendyolImage, COPY_MAX_IMAGES } from "../lib/image-copy.ts";

const T = (n) => `https://cdn.dsmcdn.com/ty/${n}.jpg`;
const BLOB = "https://x.public.blob.vercel-storage.com/";
const prod = (id, images, extra = {}) => ({ id, images, imageUrl: null, syncSnapshot: null, variations: [], ...extra });

function fakeStore(products) {
  const rows = new Map(products.map((p) => [p.id, structuredClone(p)]));
  return {
    rows,
    applied: [],
    async list() {
      return [...rows.values()].map((p) => structuredClone(p));
    },
    // koşullu yazma: satır hâlâ okunan değerdeyse
    async apply(plan) {
      const r = rows.get(plan.id);
      const same = JSON.stringify(r.images) === JSON.stringify(plan.oldImages) && r.imageUrl === plan.oldImageUrl;
      if (!same) return false;
      r.images = plan.newImages;
      r.imageUrl = plan.newImageUrl;
      r.syncSnapshot = { ...(r.syncSnapshot ?? {}), imageMap: plan.imageMap };
      for (const v of plan.variations) r.variations.find((x) => x.id === v.id).images = v.next;
      this.applied.push(plan.id);
      return true;
    },
  };
}
function fakeDeps(over = {}) {
  const puts = [];
  let t = 0;
  return {
    puts,
    fetchImage: async () => Buffer.from("src"),
    process: async () => ({ big: Buffer.from("B"), small: Buffer.from("K") }),
    blob: { async put(p) { puts.push(p); return BLOB + p; } },
    now: () => (t += 1),
    ...over,
  };
}

test("Blob yolu tools/gorsel ile birebir aynı (kare, v2)", () => {
  for (const [id, u] of [["cm123456789", T(1)], ["p2", T(99)]]) {
    assert.equal(copyPath(id, u, "b"), blobYolu(id, u, "kare", "b"));
    assert.equal(copyPath(id, u, "k"), blobYolu(id, u, "kare", "k"));
  }
  assert.equal(kaynakHash(T(1)).length, 16);
});

test("parti sınırı: en çok 4 görsel denenir, kalan sayılır, ikinci parti devam eder (idempotent)", async () => {
  const store = fakeStore([prod("a", [T(1), T(2), T(3)]), prod("b", [T(4), T(5), T(6)])]);
  const d = fakeDeps();
  const r1 = await copyBatch(store, d);
  assert.equal(COPY_MAX_IMAGES, 4);
  assert.equal(r1.kopyalanan, 4);
  assert.equal(r1.kalan, 2);
  assert.equal(r1.sirada, 2);
  assert.equal(d.puts.length, 8, "görsel başına iki yazma");
  const r2 = await copyBatch(store, fakeDeps());
  assert.equal(r2.kopyalanan, 2);
  assert.equal(r2.kalan, 0);
  const r3 = await copyBatch(store, fakeDeps());
  assert.deepEqual([r3.kopyalanan, r3.kalan, r3.sirada, r3.yazma], [0, 0, 0, 0], "bitince hiçbir şey yazılmaz");
  assert.ok([...store.rows.values()].every((p) => p.images.every((u) => u.startsWith(BLOB))));
});

test("süre bütçesi dolunca parti biter", async () => {
  const store = fakeStore([prod("a", [T(1), T(2), T(3)])]);
  let t = 0;
  const d = fakeDeps({ now: () => t, fetchImage: async () => ((t += 20_000), Buffer.from("x")) });
  const r = await copyBatch(store, d, { budgetMs: 25_000 });
  assert.equal(r.kopyalanan, 2, "20 sn + 20 sn: üçüncüye başlanmaz");
  assert.equal(r.kalan, 1);
});

test("bir görselin zaman aşımı hatası atlanır, diğerleri sürer; hata raporlanır", async () => {
  const store = fakeStore([prod("a", [T(1), T(2), T(3)])]);
  const d = fakeDeps({
    fetchImage: async (u) => {
      if (u === T(2)) throw new Error("The operation was aborted due to timeout");
      return Buffer.from("x");
    },
  });
  const r = await copyBatch(store, d);
  assert.equal(r.kopyalanan, 2);
  assert.equal(r.hatalar.length, 1);
  assert.equal(r.hatalar[0].url, T(2));
  assert.match(r.hatalar[0].hata, /timeout/);
  const row = store.rows.get("a");
  assert.deepEqual(row.images, [BLOB + copyPath("a", T(1), "b"), T(2), BLOB + copyPath("a", T(3), "b")], "sıra korunur, hatalı olan Trendyol'da kalır");
  assert.equal(r.kalan, 1);
  assert.equal(r.sirada, 0, "bu partinin hatası sıradakilerden sayılmaz (döngü takılmaz)");
});

test("atla listesi: hatalı görsel yeniden denenmez, sıradaki ilerler", async () => {
  const store = fakeStore([prod("a", [T(1), T(2)])]);
  const d = fakeDeps();
  const r = await copyBatch(store, d, { atla: new Set([T(1)]) });
  assert.equal(r.kopyalanan, 1);
  assert.equal(d.puts.length, 2);
  assert.equal(r.kalan, 1);
  assert.equal(r.sirada, 0);
});

test("Blob yazması başarısızsa o görsel ürüne YAZILMAZ; diğerleri sürer", async () => {
  const store = fakeStore([prod("a", [T(1), T(2)])]);
  const d = fakeDeps({ blob: { async put(p) { if (p.includes(kaynakHash(T(1)))) throw new Error("blob down"); return BLOB + p; } } });
  const r = await copyBatch(store, d);
  assert.equal(r.kopyalanan, 1);
  assert.equal(r.hatalar.length, 1);
  assert.equal(store.rows.get("a").images[0], T(1));
});

test("koşullu yazma: ürün okunduktan sonra değiştiyse atlanır, ezilmez", async () => {
  const store = fakeStore([prod("a", [T(1)]), prod("b", [T(2)])]);
  const realList = store.list.bind(store);
  store.list = async () => {
    const l = await realList();
    store.rows.get("a").images = [T(1), "https://elle.eklenen/x.jpg"]; // listeleme sonrası elle düzenleme
    return l;
  };
  const r = await copyBatch(store, fakeDeps());
  assert.deepEqual(r.atlananUrun, ["a"]);
  assert.equal(r.kopyalanan, 1, "yalnızca b yazıldı");
  assert.deepEqual(store.rows.get("a").images, [T(1), "https://elle.eklenen/x.jpg"]);
  assert.equal(store.rows.get("a").syncSnapshot, null);
  assert.equal(store.rows.get("b").images[0], BLOB + copyPath("b", T(2), "b"));
  assert.equal(r.kalan, 1, "atlanan ürünün görseli hâlâ bekliyor");
});

test("imageMap: eski Trendyol adresi → -b adresi kaydedilir, eski kayıt ve diğer alanlar korunur", async () => {
  const old = { images: ["x"], imageMap: { "https://cdn.dsmcdn.com/eski.jpg": BLOB + "eski-b.webp" } };
  const store = fakeStore([prod("a", [T(1), BLOB + "eski-b.webp"], { syncSnapshot: old })]);
  await copyBatch(store, fakeDeps());
  const snap = store.rows.get("a").syncSnapshot;
  assert.equal(snap.imageMap[T(1)], BLOB + copyPath("a", T(1), "b"));
  assert.equal(snap.imageMap["https://cdn.dsmcdn.com/eski.jpg"], BLOB + "eski-b.webp");
});

test("kapak ve renk görselleri de çevrilir; tekrar eden adres tekilleşir", async () => {
  const p = prod("a", [T(1), T(2)], { imageUrl: T(1), variations: [{ id: "v1", images: [T(2), T(3)] }, { id: "v2", images: ["https://elle/y.jpg"] }] });
  assert.deepEqual(sourcesOf(p), [T(1), T(2), T(3)]);
  const store = fakeStore([p]);
  const r = await copyBatch(store, fakeDeps(), { maxImages: 10 });
  assert.equal(r.kopyalanan, 3);
  const row = store.rows.get("a");
  const b = (n) => BLOB + copyPath("a", T(n), "b");
  assert.deepEqual(row.images, [b(1), b(2)]);
  assert.equal(row.imageUrl, b(1));
  assert.deepEqual(row.variations[0].images, [b(2), b(3)]);
  assert.deepEqual(row.variations[1].images, ["https://elle/y.jpg"]);
  assert.equal(buildWritePlan(row, {}), null, "yapacak iş kalmadı");
});

test("Trendyol dışı adres indirilmez (SSRF); boyut ve tür denetimi", async () => {
  await assert.rejects(() => fetchTrendyolImage("https://evil.example/a.jpg", async () => assert.fail("istek atılmamalı")), /Trendyol/);
  const ok = (h, body = "xx") => async () => new Response(body, { headers: h });
  await assert.rejects(() => fetchTrendyolImage(T(1), ok({ "content-type": "text/html" })), /görsel değil/);
  await assert.rejects(() => fetchTrendyolImage(T(1), ok({ "content-type": "image/jpeg", "content-length": String(30 * 1024 * 1024) })), /büyük/);
  assert.equal((await fetchTrendyolImage(T(1), ok({ "content-type": "image/jpeg" }))).length, 2);
});

test("A9: yönlendirme izlenmez (redirect: error); başlıksız dev gövde akışta kesilir, belleğe tamamı alınmaz", async () => {
  let init;
  const spy = async (_u, i) => {
    init = i;
    return new Response("xx", { headers: { "content-type": "image/jpeg" } });
  };
  await fetchTrendyolImage(T(1), spy);
  assert.equal(init.redirect, "error");
  assert.ok(init.signal, "zaman aşımı sinyali duruyor");
  // content-length yok, 40 MB akış: 1 MB'lık parçalarla; sınır (25 MB) aşılınca okuma durur
  let pulled = 0;
  let cancelled = false;
  const body = new ReadableStream({
    pull(c) {
      pulled++;
      c.enqueue(new Uint8Array(1024 * 1024));
      if (pulled >= 40) c.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(() => fetchTrendyolImage(T(1), async () => new Response(body, { headers: { "content-type": "image/jpeg" } })), /büyük/);
  assert.ok(cancelled && pulled < 40, `akış erken kesildi (okunan parça: ${pulled})`);
  await assert.rejects(() => fetchTrendyolImage(T(1), async () => new Response("", { headers: { "content-type": "image/jpeg" } })), /boyutu/);
});

test("uç ve arayüz kablolaması: admin oturumu, süre, Blob yok → 503, hata listesi", () => {
  const route = readFileSync(new URL("../app/api/admin/gorsel-kopyala/route.ts", import.meta.url), "utf8");
  assert.match(route, /adminGuard\(\)/);
  assert.match(route, /maxDuration = 60/);
  assert.match(route, /rateLimit\(/);
  assert.match(route, /status: 503/);
  assert.match(route, /revalidateStorefront\(\)/);
  assert.doesNotMatch(route, /\.env/);
});

test("onay metni: N görsel = 2N yazma, kalan kota 2N'den azsa uyarı, Ezerek notu", async () => {
  const { copyConfirmText, BLOB_USED_ESTIMATE, BLOB_HOBBY_LIMIT } = await import("../lib/image-copy-ui.ts");
  assert.equal(BLOB_USED_ESTIMATE, 1320);
  const kucuk = copyConfirmText(100);
  assert.match(kucuk, /100 görsel = 200 Blob yazması/);
  assert.match(kucuk, /ayda 2000, bu ay yaklaşık 1320/);
  assert.doesNotMatch(kucuk, /UYARI/);
  const buyuk = copyConfirmText(BLOB_HOBBY_LIMIT);
  assert.match(buyuk, /UYARI/);
  assert.doesNotMatch(copyConfirmText(10, "KEEP"), /Trendyol'daki değeri yaz/);
  assert.match(copyConfirmText(10, "OVERWRITE"), /Trendyol'daki değeri yaz/);
});

test("arayüz: düğme, ilerleme çubuğu, durdur, hata listesi, Ezerek uyarısı eşitleme alanına bağlı", () => {
  const ui = readFileSync(new URL("../components/AdminImageCopy.tsx", import.meta.url), "utf8");
  assert.match(ui, /Görselleri depoya kopyala/);
  assert.match(ui, /role="progressbar"/);
  assert.match(ui, /Durdur/);
  assert.match(ui, /window\.confirm\(copyConfirmText/);
  assert.match(ui, /\/api\/admin\/gorsel-kopyala/);
  assert.match(ui, /imagesMode === "OVERWRITE"/);
  const sync = readFileSync(new URL("../components/AdminTrendyolSync.tsx", import.meta.url), "utf8");
  assert.match(sync, /<AdminImageCopy pending=\{uncopiedImages\} imagesMode=\{settings\.IMAGES\}/);
});
