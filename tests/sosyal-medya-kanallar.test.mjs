import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const site = read("lib/site.ts");
const footer = read("components/Footer.tsx");
const iletisim = read("app/iletisim/page.tsx");
const home = read("app/page.tsx");

const YOUTUBE = "https://www.youtube.com/@YILDIRIMAV%C4%B0ZE";
const TIKTOK = "https://www.tiktok.com/@yildirimavizecomtr";

test("SOCIAL_LINKS: TikTok ve YouTube adresleri tam olarak tanımlı", () => {
  assert.ok(site.includes(`tiktok: "${TIKTOK}"`));
  assert.ok(site.includes(`youtube: "${YOUTUBE}"`));
  assert.match(site, /hepsiburada: "https:\/\/www\.hepsiburada\.com\/magaza\/yildirim-avize"/);
  assert.match(site, /trendyol: "https:\/\/www\.trendyol\.com\/magaza\/yildirimavize-m-379320\?sst=0"/);
  assert.match(site, /instagram: "https:\/\/www\.instagram\.com\/yildirimavize\/"/);
  assert.match(site, /facebook: "https:\/\/www\.facebook\.com\/y\.ld\.r\.m\.avize\/"/);
});

test("Footer: sıra Instagram, TikTok, YouTube, Facebook, Trendyol, Hepsiburada", () => {
  const order = ["instagram", "tiktok", "youtube", "facebook", "trendyol", "hepsiburada"].map((k) => footer.indexOf(`SOCIAL_LINKS.${k}`));
  assert.ok(order.every((i) => i > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(footer, /label: "TikTok \(@yildirimavizecomtr\)"[^\r\n]*icon: "🎵"/);
  assert.match(footer, /label: "YouTube \(Yıldırım Avize\)"[^\r\n]*icon: "▶️"/);
  assert.match(footer, /SOCIAL_LINKS\.trendyol[^\r\n]*highlight: true/);
  assert.match(footer, /SOCIAL_LINKS\.hepsiburada[^\r\n]*highlight: true/);
  assert.match(footer, /target="_blank"\r?\n\s*rel="noopener noreferrer"/);
});

test("İletişim: TikTok ve YouTube satırları var, Trendyol/Hepsiburada amber kalır", () => {
  const order = ["instagram", "tiktok", "youtube", "facebook", "trendyol", "hepsiburada"].map((k) => iletisim.indexOf(`href={SOCIAL_LINKS.${k}}`));
  assert.ok(order.every((i) => i > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(iletisim, /href=\{SOCIAL_LINKS\.tiktok\}[\s\S]{0,400}bg-surface[\s\S]{0,250}TikTok: @yildirimavizecomtr/);
  assert.match(iletisim, /href=\{SOCIAL_LINKS\.youtube\}[\s\S]{0,400}bg-surface[\s\S]{0,250}YouTube: Yıldırım Avize/);
  assert.match(iletisim, /href=\{SOCIAL_LINKS\.trendyol\}[\s\S]{0,400}bg-amber-50/);
  assert.match(iletisim, /href=\{SOCIAL_LINKS\.hepsiburada\}[\s\S]{0,400}bg-amber-50/);
});

test("sameAs: Instagram, TikTok, YouTube, Facebook sırasıyla ve mağazalar durur", () => {
  assert.match(
    home,
    /sameAs: \[\r?\n\s*SOCIAL_LINKS\.instagram,\r?\n\s*SOCIAL_LINKS\.tiktok,\r?\n\s*SOCIAL_LINKS\.youtube,\r?\n\s*SOCIAL_LINKS\.facebook,/,
  );
  assert.ok(home.includes("https://www.trendyol.com/magaza/yildirimavize-m-379320"));
  assert.ok(home.includes("https://www.hepsiburada.com/magaza/yildirim-avize"));
});
