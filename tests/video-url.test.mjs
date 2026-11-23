import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseVideoUrl, VIDEO_URL_MAX } from "../lib/video-url.ts";

const ID = "dQw4w9WgXcQ";
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const YT = { provider: "youtube", id: ID, url: `https://www.youtube.com/watch?v=${ID}`, embedUrl: `https://www.youtube-nocookie.com/embed/${ID}`, thumbUrl: `https://i.ytimg.com/vi/${ID}/hqdefault.jpg` };
const VM = { provider: "vimeo", id: "123456789", url: "https://vimeo.com/123456789", embedUrl: "https://player.vimeo.com/video/123456789" };

const VALID = [
  [`https://www.youtube.com/watch?v=${ID}`, YT],
  [`https://youtube.com/watch?v=${ID}&t=42s&si=abc`, YT],
  [`https://m.youtube.com/watch?v=${ID}`, YT],
  [`https://youtu.be/${ID}`, YT],
  [`https://youtu.be/${ID}?si=xyz`, YT],
  [`https://www.youtube.com/shorts/${ID}`, YT],
  [`https://www.youtube.com/embed/${ID}`, YT],
  [`https://www.youtube-nocookie.com/embed/${ID}`, YT],
  [`  https://youtu.be/${ID}  `, YT],
  [`HTTPS://WWW.YOUTUBE.COM/watch?v=${ID}`, YT],
  ["https://vimeo.com/123456789", VM],
  ["https://www.vimeo.com/123456789", VM],
  ["https://vimeo.com/123456789?share=copy", VM],
  ["https://player.vimeo.com/video/123456789", VM],
  ["https://player.vimeo.com/video/123456789?h=abc", VM],
];

for (const [input, expected] of VALID) {
  test(`geçerli: ${input}`, () => {
    const r = parseVideoUrl(input);
    assert.equal(r.ok, true);
    assert.deepEqual(r.video, expected);
  });
}

test("doğrudan https .mp4", () => {
  for (const u of ["https://cdn.example.com/a/b.mp4", "https://cdn.example.com/a/B.MP4", "https://x.public.blob.vercel-storage.com/v-abc.mp4?token=1"]) {
    const r = parseVideoUrl(u);
    assert.equal(r.ok, true, u);
    assert.equal(r.video.provider, "mp4");
    assert.equal(r.video.src, new URL(u).href);
    assert.equal(r.video.url, r.video.src);
  }
});

test("mp4: parça (#) atılır", () => {
  assert.equal(parseVideoUrl("https://cdn.example.com/a.mp4#t=5").video.url, "https://cdn.example.com/a.mp4");
});

test("boş / null / yalnız boşluk = video yok", () => {
  for (const v of ["", "   ", "\t", null, undefined]) assert.deepEqual(parseVideoUrl(v), { ok: true, video: null });
});

const INVALID = [
  ["http (şifresiz) youtube", `http://www.youtube.com/watch?v=${ID}`],
  ["http mp4", "http://cdn.example.com/a.mp4"],
  ["javascript:", "javascript:alert(1)"],
  ["javascript: mp4 sonekli", "javascript:alert(1)//.mp4"],
  ["data:", "data:video/mp4;base64,AAAA"],
  ["blob:", "blob:https://example.com/abc"],
  ["protokolsüz çift eğik", `//www.youtube.com/watch?v=${ID}`],
  ["protokolsüz", `www.youtube.com/watch?v=${ID}`],
  ["başka alan adı", "https://example.com/video"],
  ["benzer alan adı", `https://youtube.com.evil.test/watch?v=${ID}`],
  ["alt alan adı taklidi", `https://evilyoutube.com/watch?v=${ID}`],
  ["kullanıcı bilgisi", `https://user:pass@www.youtube.com/watch?v=${ID}`],
  ["özel port", `https://www.youtube.com:8443/watch?v=${ID}`],
  ["kısa YouTube kimliği", "https://youtu.be/abc"],
  ["uzun YouTube kimliği", `https://youtu.be/${ID}X`],
  ["watch kimliksiz", "https://www.youtube.com/watch"],
  ["YouTube ana sayfa", "https://www.youtube.com/"],
  ["YouTube kanal", "https://www.youtube.com/@kanal"],
  ["Vimeo harfli kimlik", "https://vimeo.com/abc"],
  ["Vimeo ana sayfa", "https://vimeo.com/"],
  ["Vimeo kanal", "https://vimeo.com/channels/staffpicks/123"],
  ["boşluk içeren", `https://youtu.be/${ID} x`],
  ["satır sonu", `https://youtu.be/${ID}\nhttps://evil.test`],
  ["CRLF", `https://youtu.be/${ID}\r\n`],
  ["mp4 olmayan dosya", "https://cdn.example.com/a.webm"],
  ["mp4 yolda değil sorguda", "https://cdn.example.com/a?f=.mp4"],
  ["metin", "merhaba"],
];

for (const [name, input] of INVALID) {
  test(`geçersiz: ${name}`, () => {
    const r = parseVideoUrl(input);
    assert.equal(r.ok, false);
    assert.ok(r.error.length > 0);
  });
}

test("çok uzun adres reddedilir (sınırda kabul)", () => {
  const pad = (n) => `https://cdn.example.com/${"a".repeat(n)}.mp4`;
  const okLen = VIDEO_URL_MAX - "https://cdn.example.com/.mp4".length;
  assert.equal(pad(okLen).length, VIDEO_URL_MAX);
  assert.equal(parseVideoUrl(pad(okLen)).ok, true);
  assert.equal(parseVideoUrl(pad(okLen + 1)).ok, false);
});

test("metin olmayan değer reddedilir", () => {
  for (const v of [123, {}, [], true]) assert.equal(parseVideoUrl(v).ok, false);
});

test("YouTube iframe adresi yalnız kimlikten üretilir (nocookie)", () => {
  const r = parseVideoUrl(`https://www.youtube.com/watch?v=${ID}&autoplay=1&x="><script>`);
  assert.equal(r.video.embedUrl, `https://www.youtube-nocookie.com/embed/${ID}`);
});

// Kapsam: videoUrl yalnız tekil ürün/yönetici uçlarında; kart, liste ve Trendyol akışında olmaz
test("videoUrl kart/liste/Trendyol select'lerine girmez", () => {
  for (const f of ["lib/products.ts", "lib/admin-product-list.ts", "lib/trendyol-sync.ts", "lib/trendyol-plan.ts", "lib/cart-products.ts", "lib/complement-suggestions.ts", "lib/similar-products.ts"]) {
    const lines = src(f).split(/\r?\n/);
    assert.deepEqual(lines.filter((l) => l.includes("videoUrl")), [], `${f} videoUrl içermemeli`);
  }
});

test("yönetici ucu videoUrl'i video-url.ts ile doğrular, boş = null", () => {
  const route = src("app/api/admin/product/route.ts");
  assert.match(route, /parseVideoUrl\(body\.videoUrl\)/);
  assert.match(route, /videoUrl: video\.video\?\.url \?\? null/);
});

import { isShortsUrl, videoPlayerSrc, videoAspect } from "../lib/video-url.ts";

test("shorts adresi dikey, diğerleri geniş/yerel oran", () => {
  assert.equal(isShortsUrl(`https://www.youtube.com/shorts/${ID}`), true);
  assert.equal(isShortsUrl(`https://www.youtube.com/watch?v=${ID}`), false);
  assert.equal(isShortsUrl("https://evil.test/shorts/abc"), false);
  assert.equal(isShortsUrl(null), false);
  const yt = parseVideoUrl(`https://www.youtube.com/watch?v=${ID}`).video;
  assert.equal(videoAspect(yt, `https://www.youtube.com/shorts/${ID}`), "vertical");
  assert.equal(videoAspect(yt, yt.url), "wide");
  assert.equal(videoAspect(parseVideoUrl("https://vimeo.com/123456789").video), "wide");
  assert.equal(videoAspect(parseVideoUrl("https://cdn.example.com/a.mp4").video), "native");
});

test("oynatıcı adresi: nocookie + autoplay, Vimeo autoplay, mp4 iframe değil", () => {
  assert.equal(videoPlayerSrc(parseVideoUrl(`https://youtu.be/${ID}`).video), `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0`);
  assert.equal(videoPlayerSrc(parseVideoUrl("https://vimeo.com/123456789").video), "https://player.vimeo.com/video/123456789?autoplay=1");
  assert.equal(videoPlayerSrc(parseVideoUrl("https://cdn.example.com/a.mp4").video), null);
});
