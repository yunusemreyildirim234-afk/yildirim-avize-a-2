import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("admin ucu: GET ve PATCH ilk iş adminGuard çağırır", () => {
  const src = read("app/api/admin/account-deletions/route.ts");
  for (const fn of ["GET", "PATCH"]) {
    const body = src.slice(src.indexOf(`export async function ${fn}`));
    assert.ok(body.indexOf("await adminGuard()") > -1 && body.indexOf("await adminGuard()") < 120, fn);
  }
});

test("onay tek transaction içinde ve yalnızca admin ucunda; e-posta işlemden sonra", () => {
  const src = read("app/api/admin/account-deletions/route.ts");
  assert.match(src, /\$transaction\(\(tx\) => approveDeletionRequest/);
  assert.ok(src.indexOf("approveDeletionRequest(deletionDbFor") < src.indexOf("sendAccountDeletedEmail({"));
});

test("arayüz: sayfa içi ConfirmDialog, window.confirm yok; ayrı bileşen, sayfaya yalnızca bağlanır", () => {
  const ui = read("components/AdminAccountDeletions.tsx");
  assert.match(ui, /ConfirmDialog/);
  assert.doesNotMatch(ui, /\bconfirm\(|window\.confirm|\balert\(/);
  const page = read("app/admin/page.tsx");
  assert.match(page, /<AdminAccountDeletions \/>/);
  assert.match(page, /id: "hesap-silme"/);
});
