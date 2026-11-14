import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSession, SIGNED_OUT } from "../lib/auth-session.ts";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("parseSession: girişli, çıkış, bozuk yanıt; yalnız bilinen alanlar", () => {
  assert.deepEqual(parseSession({ user: { id: "1", name: "Ayşe", email: "a@b.com", picture: "p", role: "ADMIN", twoFactorEnabled: true }, admin: true }), { user: { name: "Ayşe", email: "a@b.com", picture: "p" }, admin: true });
  assert.deepEqual(parseSession({ user: null, admin: false }), SIGNED_OUT);
  for (const bad of [null, undefined, "x", 5, {}, { user: { name: "x" } }]) assert.deepEqual(parseSession(bad), SIGNED_OUT);
  assert.equal(parseSession({ user: { email: "a@b.com" }, admin: "true" }).admin, false);
});

test("oturum çağrısı yalnız AuthContext'te; Navbar/TrackForm/ProductQuestionForm/sepet bağlamdan okur", () => {
  assert.match(read("context/AuthContext.tsx"), /fetch\("\/api\/auth\/me"\)/);
  assert.match(read("context/AuthContext.tsx"), /addEventListener\("ya-auth", refresh\)/);
  for (const f of ["components/Navbar.tsx", "components/TrackForm.tsx", "components/ProductQuestionForm.tsx", "app/sepet/page.tsx"]) {
    assert.doesNotMatch(read(f), /fetch\("\/api\/auth\/me/, f);
    assert.match(read(f), /useAuth\(\)/, f);
  }
  assert.match(read("app/layout.tsx"), /<AuthProvider>/);
});
