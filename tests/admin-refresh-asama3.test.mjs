import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rd = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("CMP-02 aşama 3: AdminBulkBar ve AdminProductEditor doğrudan router.refresh() çağırmaz", () => {
  for (const f of ["../components/AdminBulkBar.tsx", "../components/AdminProductEditor.tsx"]) {
    const src = rd(f);
    assert.doesNotMatch(src, /router\.refresh\(/, f);
    assert.match(src, /from "@\/lib\/admin-refresh"/, f);
  }
});

test("toplu işlem hemen yeniler; editör kaydı başarıda sakin uzlaştırma, başarısızlıkta (409 vb.) hemen", () => {
  assert.match(rd("../components/AdminBulkBar.tsx"), /refreshAdminNow\(router\)/);
  const ed = rd("../components/AdminProductEditor.tsx");
  assert.match(ed, /if \(failed\.length > 0\) refreshAdminNow\(router\);\s*else scheduleAdminRefresh\(router\);/);
  // renk ekle/sil/ad: sunucudaki yeni kimlik gerekir, hemen yenile
  assert.match(ed, /await fn\(\);[\s\S]{0,120}refreshAdminNow\(router\)/);
});

test("kayıt sonrası değer görünür kalır: başarılı parça sunucu kabulünden SONRA tabana işlenir", () => {
  const ed = rd("../components/AdminProductEditor.tsx");
  const i = ed.indexOf("const data = await api(s.method, s.url, s.body);");
  const j = ed.indexOf("b = commitStep(b, sent, s);");
  assert.ok(i > 0 && j > i, "commitStep, api çağrısından sonra gelmeli (iyimser tahmin yok)");
});
