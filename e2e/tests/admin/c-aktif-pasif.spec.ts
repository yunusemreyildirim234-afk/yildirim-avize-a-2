import type { APIRequestContext, Dialog, Page } from "@playwright/test";
import { test, expect } from "../../fixtures";
import { expandPanel, openAdmin } from "../../admin-helpers";
import { exec, rows } from "../../db";

// Admin: ürünü Aktif yap / Pasife al (tek: rozet kısayolu ve düzenleme bölümü; toplu: Toplu işlem çubuğu), onay penceresi ve Geri Al.
// Yalnızca "E2E Aktif" önekli ürünler üretilir ve sonda silinir.
const KAT = "E2E Aktif Kat";
const POLL = { timeout: 40_000, intervals: [1000, 2000, 3000] };
const T = { a: "E2E Aktif A Pasif Stoklu", b: "E2E Aktif B Pasif Stoklu", c: "E2E Aktif C Stoksuz" };
const id: Record<keyof typeof T, string> = { a: "", b: "", c: "" };
const status = async (request: APIRequestContext, path: string) => (await request.get(path, { maxRedirects: 0 })).status();
const isActive = async (pid: string) => (await rows<{ active: boolean }>(`select active from "Product" where id = $1`, [pid]))[0].active;

async function insert(title: string, active: boolean, stock: number) {
  const [p] = await rows<{ id: string }>(`insert into "Product" (id, title, category, "basePrice", active, "updatedAt") values (gen_random_uuid()::text, $1, $2, 500, $3, now()) returning id`, [title, KAT, active]);
  await exec(`insert into "ProductVariation" (id, "productId", "variationType", "variationValue", stock) values (gen_random_uuid()::text, $1, 'Renk', 'Altın', $2)`, [p.id, stock]);
  return p.id;
}

/** Onay pencerelerini toplar; accept false ise iptal eder. */
function dialogs(page: Page) {
  const state = { messages: [] as string[], accept: true };
  page.on("dialog", (d: Dialog) => {
    state.messages.push(d.message());
    void (state.accept ? d.accept() : d.dismiss());
  });
  return state;
}

async function openList(page: Page, query: string) {
  await openAdmin(page);
  await expandPanel(page, /^Tüm Ürünler/);
  await page.getByLabel("Ürün ismi, stok kodu veya model kodu ile ara").fill(query);
}
const undoBtn = (page: Page) => page.getByRole("button", { name: /Son İşlemi Geri Al/ });
/** Seçim çubuğundaki toplu işlem katmanını açar (kapalıysa). */
async function openBulk(page: Page) {
  const toggle = page.locator('button[aria-controls="admin-selection-detail"]');
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
}
const applyBtn = (page: Page) => page.getByRole("button", { name: /ürüne uygula/ });

test.describe.configure({ mode: "serial" });

test.describe("Aktif yap / Pasife al", () => {
  test.beforeAll(async () => {
    id.a = await insert(T.a, false, 5);
    id.b = await insert(T.b, false, 4);
    id.c = await insert(T.c, true, 0);
  });
  test.afterAll(async () => {
    await exec(`delete from "Product" where title like 'E2E Aktif%'`).catch(() => {});
  });

  test("rozet kısayolu: iptal edilince değişiklik yok; onaylanınca vitrinde görünür; Geri Al tekrar gizler", async ({ page, request }) => {
    const dlg = dialogs(page);
    await openList(page, T.a);
    await expect(page.getByTestId("stoklu-pasif-rozet")).toHaveCount(1);
    const btn = page.getByTestId("vitrine-al");
    expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(40);

    dlg.accept = false;
    await btn.click();
    await expect.poll(() => dlg.messages.length).toBe(1);
    expect(dlg.messages[0]).toContain(`"${T.a}" vitrine alınacak`);
    expect(dlg.messages[0]).not.toContain("Stoğu 0"); // stoklu: Tükendi uyarısı yok
    expect(dlg.messages[0]).toContain('Trendyol eşitlemesinde "Aktif/pasif" satırı "Ezerek" ise');
    await page.waitForTimeout(500);
    expect(await isActive(id.a), "iptal: değişmedi").toBe(false);
    expect(await status(request, `/urun/${id.a}`)).toBe(404);

    dlg.accept = true;
    const [res] = await Promise.all([page.waitForResponse((r) => r.url().includes("/api/admin/product") && r.request().method() === "PATCH"), btn.click()]);
    expect(res.status()).toBe(200);
    expect(await isActive(id.a)).toBe(true);
    await expect.poll(() => status(request, `/urun/${id.a}`), POLL).toBe(200);
    await expect(page.getByTestId("stoklu-pasif-rozet")).toHaveCount(0);

    const [undo] = await Promise.all([page.waitForResponse((r) => r.url().includes("/api/admin/undo")), undoBtn(page).click()]);
    expect(undo.status()).toBe(200);
    expect(await isActive(id.a), "Geri Al: tekrar pasif").toBe(false);
    await expect.poll(() => status(request, `/urun/${id.a}`), POLL).toBe(404);
  });

  test("düzenleme bölümü: pasife al / aktif yap; stoğu 0 ürünü aktif yaparken 'Tükendi' uyarısı", async ({ page }) => {
    const dlg = dialogs(page);
    await openList(page, T.c);
    await page.locator(`#ap-${id.c}`).getByRole("button", { name: "Düzenle" }).click();
    await expect(page.getByTestId("durum-etiketi")).toContainText("Aktif");

    await page.getByTestId("duzenle-pasife-al").click();
    await expect.poll(() => isActive(id.c), POLL).toBe(false);
    expect(dlg.messages.at(-1)).toContain("vitrinden kaldırılacak");
    await expect(page.getByTestId("durum-etiketi")).toContainText("Pasif");

    await page.getByTestId("duzenle-vitrine-al").click();
    await expect.poll(() => isActive(id.c), POLL).toBe(true);
    expect(dlg.messages.at(-1)).toContain("Stoğu 0, 'Tükendi' olarak görünecek.");
    expect(dlg.messages.at(-1)).toContain('"Ezerek"');
  });

  test("toplu işlem: Aktif/Pasif sekmesi; iptalde değişiklik yok; onayla hepsi aktif; Geri Al hepsini pasife döndürür", async ({ page, request }) => {
    const dlg = dialogs(page);
    await openList(page, "E2E Aktif");
    await page.getByLabel(`${T.a} seç`).check();
    await page.getByLabel(`${T.b} seç`).check();
    await openBulk(page);
    await page.getByRole("button", { name: "Aktif/Pasif", exact: true }).click();
    await page.getByLabel("Aktif/Pasif işlemi").selectOption("on");

    dlg.accept = false;
    await applyBtn(page).click();
    await expect.poll(() => dlg.messages.length).toBeGreaterThan(0);
    expect(dlg.messages.at(-1)).toContain("2 ürün vitrine alınacak");
    expect(dlg.messages.at(-1)).toContain('"Ezerek"');
    await page.waitForTimeout(500);
    expect([await isActive(id.a), await isActive(id.b)]).toEqual([false, false]);

    dlg.accept = true;
    const [res] = await Promise.all([page.waitForResponse((r) => r.url().includes("/api/admin/product/bulk") && !(r.request().postData() ?? "").includes("dryRun")), applyBtn(page).click()]);
    expect(res.status()).toBe(200);
    expect([await isActive(id.a), await isActive(id.b)]).toEqual([true, true]);
    await expect.poll(() => status(request, `/urun/${id.b}`), POLL).toBe(200);

    const [undo] = await Promise.all([page.waitForResponse((r) => r.url().includes("/api/admin/undo")), undoBtn(page).click()]);
    expect(undo.status()).toBe(200);
    expect([await isActive(id.a), await isActive(id.b)]).toEqual([false, false]);
  });

  test("toplu pasife al: aktif ürün pasife alınır, zaten pasif olan atlanır; sunucu yalnızca boolean kabul eder", async ({ page, request }) => {
    const dlg = dialogs(page);
    await openList(page, "E2E Aktif");
    await page.getByLabel(`${T.a} seç`).check();
    await page.getByLabel(`${T.c} seç`).check();
    await openBulk(page);
    await page.getByRole("button", { name: "Aktif/Pasif", exact: true }).click();
    await page.getByLabel("Aktif/Pasif işlemi").selectOption("off");
    await applyBtn(page).click();
    await expect.poll(() => isActive(id.c), POLL).toBe(false);
    expect(dlg.messages.some((m) => m.includes("1 ürün vitrinden kaldırılacak") && m.includes("1 ürün zaten bu durumda"))).toBe(true);
    expect((await request.patch("/api/admin/product", { data: { productId: id.a, active: "false" } })).status()).toBe(400);
    expect((await request.post("/api/admin/product/bulk", { data: { ids: [id.a], action: "active", value: 1 } })).status()).toBe(400);
    expect(await isActive(id.a)).toBe(false);
  });

  test("mobil (390 px): Aktif/Pasif sekmesi ve rozet düğmesi taşma yapmaz", async ({ page }) => {
    dialogs(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openList(page, T.a);
    await expect(page.getByTestId("vitrine-al")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.getByLabel(`${T.a} seç`).check();
    await openBulk(page);
    await expect(page.getByRole("button", { name: "Aktif/Pasif", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
});
