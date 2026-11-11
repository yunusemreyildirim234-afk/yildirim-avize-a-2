import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("A2: iki yönetici sayfası render başında oturumu kendisi doğrular (proxy tek hata noktası olmasın)", () => {
  const guard = read("lib/admin-guard.ts");
  assert.match(guard, /export async function requireAdminPage/);
  assert.match(guard, /verifyAdminSession\(token\)/);
  assert.match(guard, /redirect\("\/giris\?tab=yonetici"\)/);
  for (const f of ["app/admin/page.tsx", "app/admin/siparis/[id]/page.tsx"]) {
    const s = read(f);
    assert.match(s, /import \{ requireAdminPage \} from "@\/lib\/admin-guard"/, f);
    // denetim, veritabanı okumalarından önce gelir
    assert.ok(s.includes("await requireAdminPage()"), f);
  }
  const orderPage = read("app/admin/siparis/[id]/page.tsx");
  assert.ok(orderPage.indexOf("await requireAdminPage()") < orderPage.indexOf("prisma.order.findUnique"));
  const adminPage = read("app/admin/page.tsx");
  assert.ok(adminPage.indexOf("await requireAdminPage()") < adminPage.indexOf("} = await getAdminData()"));
});
