import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

function walk(dir, out = []) {
  for (const n of readdirSync(join(root, dir))) {
    const rel = `${dir}/${n}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(n)) out.push(rel);
  }
  return out;
}

// window olay adları (depolama anahtarı değil)
const EVENT_NAMES = new Set(["ya-auth", "ya-cart-merged", "ya-avantaj-ac", "ya-avantaj-degisti"]);

test("koddaki her ya* / yildirim_* depolama ve çerez anahtarı çerez politikasında geçer", () => {
  const files = ["app", "lib", "components", "context"].flatMap((d) => walk(d));
  const keys = new Set();
  for (const f of files) {
    for (const m of read(f).matchAll(/["'`](ya[_-][A-Za-z0-9_-]*|yildirim_[a-z_]+)(?:\$\{[^}]*\})?[A-Za-z0-9_-]*["'`]/g)) {
      let k = m[0].slice(1, -1);
      k = k.replace(/\$\{[^}]*\}.*$/, "*"); // ya_sync_${endpoint} -> ya_sync_*
      if (!EVENT_NAMES.has(k)) keys.add(k);
    }
  }
  assert.ok(keys.size >= 15, `anahtar taraması çalışmıyor (${keys.size})`);
  const policy = read("app/cerez-politikasi/page.tsx");
  const missing = [...keys].filter((k) => !policy.includes(k));
  assert.deepEqual(missing, [], `politikada olmayan anahtarlar: ${missing.join(", ")}`);
});

test("politika: analitik/pazarlama bölümü gerçeği söyler, eski 'kullanılmamaktadır' cümlesi yok", () => {
  const p = read("app/cerez-politikasi/page.tsx");
  assert.doesNotMatch(p, /kullanılmamaktadır/);
  assert.match(p, /Analitik ve Pazarlama Çerezleri/);
  assert.match(p, /Google Tag Manager/);
  assert.match(p, /_ga, _ga_\* ve _gcl_\*/);
  assert.match(p, /'Reddet' derseniz bu araçlar yüklenmez/);
  assert.match(p, /çerez çubuğu yeniden görünür/);
});

test("çerez çubuğu: yeni metin, düğmeler ve tercih anahtarı aynı; GTM varsayılanı değişmedi", () => {
  const b = read("components/CookieBanner.tsx");
  assert.match(b, /Sitemizin çalışması için zorunlu çerezler kullanırız/);
  assert.match(b, /Google Analytics/);
  assert.match(b, /yalnız zorunlu çerezler kullanılır/);
  assert.match(b, /href="\/cerez-politikasi"/);
  assert.match(b, /answer\("accepted"\)/);
  assert.match(b, /answer\("rejected"\)/);
  assert.match(b, /Kabul Et/);
  assert.match(b, /Reddet/);
  const g = read("lib/gtm.ts");
  assert.match(g, /gtag\("consent", "default", \{ \.\.\.allAs\("denied"\)/);
  assert.match(g, /if \(c === "accepted"\) \{\s*gtag\("consent", "update", allAs\("granted"\)\)/);
});
