// Ağsız test: yalnız saf fonksiyonlar, sahte yanıtla. fetch çağrılmaz (betik içe aktarılınca main çalışmaz).
import test from "node:test";
import assert from "node:assert/strict";

const realFetch = globalThis.fetch;
globalThis.fetch = () => {
  throw new Error("Testte ağ isteği yasak");
};
const { describeItems, isVideoKey, videoHint } = await import("../tools/trendyol-video-kesfi.mjs");
globalThis.fetch = realFetch;

const FULL_URL = "https://cdn.ornek-video.test/yol/gizli-klip-123.mp4?token=ABC";
const YT_URL = "https://www.youtube.com/watch?v=SECRETID99";
const FAKE = [
  {
    barcode: "BRC-GIZLI-1",
    title: "Gizli Başlık Avize",
    supplierName: "Ayşe Yılmaz",
    phone: "05551112233",
    email: "ayse@example.invalid",
    address: "Gizli Mah. Sok. 1",
    quantity: 3,
    images: [{ url: "https://cdn.test/a.jpg" }],
    videoUrl: FULL_URL,
    media: { items: [{ link: YT_URL, kind: "x" }] },
    extra: null,
  },
];

test("alan yolları ve tipler yazılır; değerler (kimlik, ad, telefon, e-posta, adres) hiç yazılmaz", () => {
  const out = describeItems(FAKE).join("\n");
  assert.match(out, /content\[\]\.barcode: string/);
  assert.match(out, /content\[\]\.quantity: number/);
  assert.match(out, /content\[\]\.images\[\]\.url: string/);
  assert.match(out, /content\[\]\.extra: null/);
  for (const secret of ["BRC-GIZLI-1", "Gizli Başlık", "Ayşe", "05551112233", "ayse@example.invalid", "Gizli Mah", "SECRETID99", "gizli-klip-123", "token=ABC", "/yol/"]) {
    assert.ok(!out.includes(secret), `çıktıda olmamalı: ${secret}`);
  }
});

test("video ipucu: alan işaretlenir, adres yerine yalnız alan adı (host) ve uzantı yazılır", () => {
  const lines = describeItems(FAKE);
  const video = lines.find((l) => l.startsWith("content[].videoUrl:"));
  assert.match(video, /\[VIDEO\?\]/);
  assert.match(video, /alan adı=cdn\.ornek-video\.test, uzantı=mp4/);
  assert.ok(!video.includes("http"));
  const yt = lines.find((l) => l.startsWith("content[].media.items[].link:"));
  assert.match(yt, /\[VIDEO\?\]/); // yol "media" içerir
  assert.match(yt, /alan adı=www\.youtube\.com/);
  assert.ok(!yt.includes("watch"));
  assert.ok(lines.filter((l) => l.includes("[VIDEO?]")).length >= 3); // videoUrl, media, media.items..., link
  assert.ok(!lines.find((l) => l.startsWith("content[].quantity:")).includes("[VIDEO?]"));
});

test("isVideoKey ve videoHint", () => {
  for (const k of ["videoUrl", "mp4Link", "mediaList", "youtubeId", "VIDEO"]) assert.equal(isVideoKey(k), true, k);
  for (const k of ["images", "title", "barcode"]) assert.equal(isVideoKey(k), false, k);
  assert.deepEqual(videoHint("https://a.b/x.MP4"), { host: "a.b", ext: "mp4" });
  assert.deepEqual(videoHint("https://youtu.be/abc"), { host: "youtu.be", ext: "-" });
  assert.equal(videoHint("https://cdn.test/a.jpg"), null);
  assert.equal(videoHint("düz metin"), null);
  assert.equal(videoHint(42), null);
});

test("en çok 20 ürün işlenir; dizi değilse boş", () => {
  const many = Array.from({ length: 30 }, (_, i) => (i < 20 ? { a: 1 } : { sadece21den_sonra: 1 }));
  const out = describeItems(many).join("\n");
  assert.ok(!out.includes("sadece21den_sonra"));
  assert.deepEqual(describeItems(undefined), []);
  assert.deepEqual(describeItems({}), []);
});
