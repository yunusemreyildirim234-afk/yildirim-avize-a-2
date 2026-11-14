import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_alias.mjs";

const { COMPANY_DEFAULTS, toPublicCompany, companyLine, taxValue } = await import("../lib/company.ts");

test("yer tutucu vergi no (fabrika varsayılanı) gösterilmez; gerçek olan korunur", () => {
  assert.equal(toPublicCompany(COMPANY_DEFAULTS).taxNumber, "");
  assert.doesNotMatch(companyLine(toPublicCompany(COMPANY_DEFAULTS)), /11111111111/);
  assert.match(companyLine(toPublicCompany(COMPANY_DEFAULTS)), /Vergi Dairesi \/ No: Beyoğlu Vergi Dairesi —/);
  const real = toPublicCompany({ ...COMPANY_DEFAULTS, taxNumber: "1234567890" });
  assert.equal(real.taxNumber, "1234567890");
  assert.match(companyLine(real), /Beyoğlu Vergi Dairesi \/ 1234567890/);
  assert.equal(taxValue("", ""), "");
});

test("veritabanı hatası önbelleğe girmez: okuma hatayı yutmaz, sarmalayıcı varsayılana düşer", () => {
  const s = readFileSync(new URL("../lib/company.ts", import.meta.url), "utf8");
  const inner = s.slice(s.indexOf("const readCompanyInfo"), s.indexOf("export async function getCompanyInfo"));
  assert.doesNotMatch(inner, /\.catch\(/);
  assert.match(s, /export async function getCompanyInfo[\s\S]*catch \{\s*return COMPANY_DEFAULTS/);
});
