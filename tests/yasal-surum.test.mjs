import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import "./_alias.mjs";

const L = await import("../lib/legal-texts.ts");

// Hukuki metinlerin SHA-256 özeti (ilk 16 hex). Bir metin değişirse bu test kırılır:
// metni değiştirdiysen sürüm tarihini (lib/legal-texts.ts LEGAL_UPDATED ve aydınlatma sayfasındaki updated) artır, sonra aşağıdaki tabloyu ve LEGAL_UPDATED_PINNED'ı güncelle.
const LEGAL_UPDATED_PINNED = "21 Kasım 2026";
const DIGESTS = {
  "CAYMA": "14209edf20874c58",
  "AYIPLI_MAL": "54a3e1f00bbd7d33",
  "ODEME": "c76e817965e985eb",
  "TESLIMAT_SURESI": "cc6dadcc8f98bf27",
  "MONTAJ_NOTU": "a495c56c5690bcd1",
  "IADE_TALIMATI": "a6ebdd5c511932ff",
  "components/ContractModal.tsx": "b006ab98a5aacfc7",
  "app/aydinlatma-metni/page.tsx": "0856bbc6fcc86533",
};

const sha = (t) => createHash("sha256").update(t.replace(/\r\n/g, "\n")).digest("hex").slice(0, 16);
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const current = () => ({
  ...Object.fromEntries(["CAYMA", "AYIPLI_MAL", "ODEME", "TESLIMAT_SURESI", "MONTAJ_NOTU", "IADE_TALIMATI"].map((k) => [k, sha(JSON.stringify(L[k]))])),
  "components/ContractModal.tsx": sha(read("components/ContractModal.tsx")),
  "app/aydinlatma-metni/page.tsx": sha(read("app/aydinlatma-metni/page.tsx")),
});

test("hukuki metin özetleri sabit; değiştiyse sürüm tarihi artırılmış olmalı", () => {
  const now = current();
  const changed = Object.keys(DIGESTS).filter((k) => now[k] !== DIGESTS[k]);
  if (changed.length === 0) return;
  assert.notEqual(
    L.LEGAL_UPDATED,
    LEGAL_UPDATED_PINNED,
    `Metni değiştirdin (${changed.join(", ")}): sürüm tarihini (LEGAL_UPDATED) artır, tablodaki özeti güncelle`,
  );
  assert.fail(`Sürüm tarihi artırıldı; tablodaki özetleri ve LEGAL_UPDATED_PINNED değerini güncelle (${changed.join(", ")})`);
});

test("sürüm tarihi tek kaynaktan: LEGAL_VERSION = LEGAL_UPDATED, aydınlatma sayfası aynı tarihi gösterir", () => {
  assert.equal(L.LEGAL_VERSION, L.LEGAL_UPDATED);
  assert.ok(read("app/aydinlatma-metni/page.tsx").includes(`updated="${L.LEGAL_UPDATED}"`));
});
