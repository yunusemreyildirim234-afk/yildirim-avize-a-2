import { test, expect } from "../fixtures";

const productHrefs = (html: string) => new Set([...html.matchAll(/href="(\/urun\/[^"]+)"/g)].map((m) => m[1]));
const more = (page: import("@playwright/test").Page) => page.getByRole("button", { name: /^Daha fazla göster \(\d+\)$/ });

test.describe("l) Ana sayfa: kalan ürünler sayfaya gömülü değil, tıklanınca gelir (paket B1)", () => {
  test("sunucu çıktısı küçük: yalnızca görünür ürünler gömülü, kalanlar HTML'de yok", async ({ request }) => {
    const res = await request.get("/");
    const body = await res.body();
    expect(body.length, "ana sayfa HTML boyutu").toBeLessThan(900_000);
    const links = productHrefs(body.toString("utf8"));
    expect(links.size, "HTML'deki ürün bağlantısı sayısı").toBeLessThan(60);
    const rsc = await request.get("/", { headers: { RSC: "1" } });
    expect((await rsc.body()).length, "RSC yükü").toBeLessThan(450_000);
  });

  test("'Daha fazla göster' tıklanınca ek ürünler gelir; kartlar aynı görünür; sayaç azalır", async ({ page, consoleErrors }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const btn = more(page).first();
    test.skip((await btn.count()) === 0, "bu veritabanında 'Daha fazla göster' yok");
    const section = page.locator("section", { has: btn }).first();
    const cards = section.locator("a[href^='/urun/']");
    const before = await cards.count();
    const total = Number((await btn.textContent())!.match(/\((\d+)\)/)![1]);
    const firstCardClass = await section.locator("div.group.relative").first().getAttribute("class");
    await btn.click();
    await expect.poll(() => cards.count(), { timeout: 30_000 }).toBeGreaterThan(before);
    const loaded = (await cards.count()) - before;
    expect(loaded).toBeLessThanOrEqual(24);
    expect(loaded).toBeGreaterThan(0);
    // Yüklenen kartlar sayfadakilerle aynı sınıfları taşır (aynı görünüm)
    const lastCardClass = await section.locator("div.group.relative").last().getAttribute("class");
    expect(lastCardClass).toBe(firstCardClass);
    // Tekrar yok
    const hrefs = await cards.evaluateAll((els) => els.map((a) => a.getAttribute("href")));
    expect(new Set(hrefs).size, "aynı ürün iki kez gelmedi").toBe(hrefs.length);
    // Sayaç azaldı veya düğme kalktı
    if (loaded < total) await expect(more(page).first()).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("hata durumunda sayfa bozulmaz: uyarı görünür, düğme yeniden denenebilir", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const btn = more(page).first();
    test.skip((await btn.count()) === 0, "bu veritabanında 'Daha fazla göster' yok");
    const section = page.locator("section", { has: btn }).first();
    const before = await section.locator("a[href^='/urun/']").count();
    let calls = 0;
    await page.route("**/*", (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.headers()["next-action"]) {
        calls++;
        return route.abort("failed");
      }
      return route.continue();
    });
    await btn.click();
    await expect(page.getByText("Ürünler şu an getirilemedi")).toBeVisible();
    expect(calls).toBeGreaterThan(0);
    expect(await section.locator("a[href^='/urun/']").count(), "ürünler değişmedi").toBe(before);
    await expect(btn).toBeEnabled();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });
});

// Elle görsel inceleme için: SHOTS=<klasör> verilirse tıklama öncesi/sonrası görüntü alır (verilmezse atlanır)
test("görsel inceleme ekran görüntüleri (isteğe bağlı)", async ({ page }, info) => {
  const dir = process.env.SHOTS;
  test.skip(!dir, "SHOTS tanımlı değil");
  await page.goto("/", { waitUntil: "networkidle" });
  const btn = more(page).first();
  await btn.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/b1-${info.project.name}-once.png` });
  await btn.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}/b1-${info.project.name}-sonra.png` });
});

test.describe("l) JavaScript kapalıyken zarif düşüş", () => {
  test.use({ javaScriptEnabled: false });
  test("'Tümünü gör' bağlantısı kategori sayfasına götürür", async ({ page }) => {
    await page.goto("/");
    const html = await page.content();
    test.skip(!/Daha fazla göster/.test(html), "bu veritabanında 'Daha fazla göster' yok");
    // noscript içeriği JS kapalıyken gerçek öğedir
    const link = page.getByRole("link", { name: "Tümünü gör" }).first();
    await expect(link).toHaveAttribute("href", /\/kategori\/(one-cikanlar|indirimli|cok-satanlar)/);
  });
});
