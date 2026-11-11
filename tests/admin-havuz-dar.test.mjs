import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const body = (s, start, end) => s.slice(s.indexOf(start), s.indexOf(end, s.indexOf(start))).replace(/\s+/g, " ");

const admin = src("lib/homepage-admin.ts");
const products = src("lib/products.ts");
const homepage = src("lib/homepage.ts");
// Dar sürümdeki işlev adları vitrin adlarına çevrilince gövdeler birebir aynı olmalı (kural değişirse iki yer birlikte güncellenir)
const toShowcase = (s) => s.replace(/getShowcaseSlim/g, "getShowcaseProducts").replace(/getActiveSlim/g, "getActiveProducts").replace(/getBestSellersSlim/g, "getBestSellers");

test("panel havuzu yalnızca kimlik, başlık ve model kodu okur", () => {
  assert.match(admin, /const SLIM = \{ id: true, title: true, modelCode: true \} satisfies Prisma\.ProductSelect;/);
  assert.ok(!/CARD_SELECT|CARD_LIST_SELECT|variations:|images:/.test(admin));
  assert.equal((admin.match(/select: SLIM/g) ?? []).length, 2);
});

test("Çok Satanlar: dar sürüm vitrin işleviyle aynı adımları uygular", () => {
  const a = toShowcase(body(admin, "export async function getBestSellersSlim(take: number) {", "/** lib/homepage.ts getSectionPools"));
  const b = body(products + "\n/** SON */", "export async function getBestSellers(take: number) {", "/** SON */");
  assert.equal(a.replace("export async function getBestSellers(take: number) {", "").trim(), b.replace("export async function getBestSellers(take: number) {", "").trim());
});

test("bölüm havuzları: dar sürüm vitrinle aynı kümeler, sıra ve havuz boyu", () => {
  const a = toShowcase(body(admin + "\n/** SON */", "const flagged = await", "/** SON */"));
  const b = body(homepage + "\n/** SON */", "const flagged = await", "/** SON */").replace("});", "}");
  assert.equal(a.trim(), b.trim());
  assert.match(admin, /const POOL = 100;/);
  assert.match(homepage, /const POOL = 100;/);
  // aynı sıralama kuralları
  assert.match(admin, /select: SLIM, orderBy: SHOWCASE_ORDER_BY, take/);
  assert.match(admin, /select: SLIM, orderBy: \{ updatedAt: "desc" \}, take/);
  assert.match(products, /select: CARD_LIST_SELECT, orderBy: SHOWCASE_ORDER_BY, take/);
  assert.match(products, /select: CARD_LIST_SELECT, orderBy: \{ updatedAt: "desc" \}, take/);
});

test("panel dar işlevi, vitrin tam işlevi kullanır (vitrin işlevi değişmedi)", () => {
  const page = src("app/admin/page.tsx");
  assert.match(page, /getAdminSectionPools\(\)/);
  assert.ok(!/getSectionPools/.test(page));
  assert.match(src("app/page.tsx"), /getSectionPools\(\)/);
  assert.match(src("app/home-more.tsx"), /getSectionPools\(\)/);
});
