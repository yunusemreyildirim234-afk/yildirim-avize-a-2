import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { copyText } from "../lib/clipboard.ts";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("pano API'si çalışırsa yedeğe geçilmez", async () => {
  const log = [];
  const ok = await copyText("KOD", { writeText: async (t) => void log.push(["api", t]), execCopy: (t) => (log.push(["fallback", t]), true) });
  assert.equal(ok, true);
  assert.deepEqual(log, [["api", "KOD"]]);
});

test("pano API'si reddederse textarea yedeği denenir", async () => {
  const log = [];
  const ok = await copyText("KOD", { writeText: async () => { throw new Error("izin yok"); }, execCopy: (t) => (log.push(t), true) });
  assert.equal(ok, true);
  assert.deepEqual(log, ["KOD"]);
});

test("pano API'si yoksa doğrudan yedek; ikisi de olmazsa false", async () => {
  assert.equal(await copyText("K", { execCopy: () => true }), true);
  assert.equal(await copyText("K", { writeText: async () => { throw new Error("x"); }, execCopy: () => false }), false);
  assert.equal(await copyText("K", { execCopy: () => { throw new Error("x"); } }), false);
  assert.equal(await copyText("K", {}), false);
});

test("üç düğme aynı yardımcıyı kullanır; prompt yalnız en son yedek; paylaşılan adres kanonik", () => {
  for (const f of ["components/CopyTrackingCode.tsx", "components/CopyCodeButton.tsx", "components/ProductShareButton.tsx"]) {
    assert.match(read(f), /from "@\/lib\/clipboard"/, f);
  }
  assert.doesNotMatch(read("components/ProductShareButton.tsx"), /execCommand|window\.location\.href/);
  assert.match(read("components/ProductShareButton.tsx"), /\$\{SITE_URL\}\$\{productPath\(product\)\}/);
  const c = read("components/CopyCodeButton.tsx");
  assert.ok(c.indexOf("copyText(text)") < c.indexOf("window.prompt"));
  const t = read("components/CopyTrackingCode.tsx");
  assert.match(t, /\(pointer: fine\)/);
  assert.match(t, /Ctrl\+C ile kopyalayın/);
  assert.match(t, /Kod seçildi, uzun basıp Kopyala'ya dokunun/);
  assert.match(t, /state === "ok" \? "Kopyalandı"/);
});
