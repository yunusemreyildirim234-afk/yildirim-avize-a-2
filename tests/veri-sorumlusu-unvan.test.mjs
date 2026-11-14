import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("unvan tek kaynaktan: toPublicCompany boş alanda 'Yıldırım Avize' yedeğini kullanır, unvan koda gömülü değil", () => {
  const c = read("lib/company.ts");
  assert.match(c, /title: c\.companyTitle\.trim\(\) \|\| BRAND_FALLBACK_TITLE/);
  assert.match(c, /BRAND_FALLBACK_TITLE = "Yıldırım Avize"/);
});

test("gizlilik, aydınlatma, sözleşme ve iptal-iade sayfaları unvanı getCompanyInfo üzerinden alır", () => {
  const g = read("app/gizlilik-politikasi/page.tsx");
  assert.match(g, /toPublicCompany\(await getCompanyInfo\(\)\)\.title/);
  assert.doesNotMatch(g, /Yıldırım Avize Aydınlatma/);
  for (const f of ["app/aydinlatma-metni/page.tsx", "app/mesafeli-satis-sozlesmesi/page.tsx", "app/iptal-iade-cayma/page.tsx"]) {
    assert.match(read(f), /companyLine\(/, f);
    assert.match(read(f), /getCompanyInfo\(\)/, f);
  }
});

test("hiçbir yerde 'Yıldırım Avize Aydınlatma' elle yazılı değil", () => {
  for (const f of ["app/aydinlatma-metni/page.tsx", "app/gizlilik-politikasi/page.tsx", "app/mesafeli-satis-sozlesmesi/page.tsx", "lib/legal-texts.ts", "components/ContractModal.tsx"]) {
    assert.doesNotMatch(read(f), /Yıldırım Avize Aydınlatma/, f);
  }
});
