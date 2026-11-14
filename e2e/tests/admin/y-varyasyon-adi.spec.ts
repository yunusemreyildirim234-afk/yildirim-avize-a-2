import { test, expect } from "../../fixtures";
import { autoDialogs, cleanupE2eCategories, cleanupE2eProducts, createProductViaForm, expandPanel, findInProductList, openAdmin, refreshStorefront, uniq } from "../../admin-helpers";
import { exec, productIdByTitle, rows } from "../../db";

const PREFIX = "E2E Varyasyon Adi";
const SHOT = process.env.SHOT_DIR;

// Seçenek türü varyasyonlar e2e veritabanında (güvenlik kilidi arkasında, mevcut exec yardımcısıyla) kurulur; ürünler sonda silinir.
test.describe("Admin: varyasyon adı düzenleme + rengi toplu değiştirme (E2E önekli veri, sonda silinir)", () => {
  test.afterAll(async ({ request }) => {
    await cleanupE2eProducts(request, PREFIX);
    await cleanupE2eCategories(request);
  });

  test("tek ad: önizleme, normalize kayıt, engeller, uyarı onayı, Geri Al; toplu renk: önizleme, uygulama, ebat korunur, çakışma; vitrin filtresi; mobil", async ({ page, request }) => {
    const tag = uniq();
    const a = `${PREFIX} A ${tag}`;
    const b = `${PREFIX} B ${tag}`;
    const catName = `E2E Varyasyon Adi ${tag}`;
    const LIST = `/kategori/${catName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}?adet=tumu`;
    const dialogs = autoDialogs(page);
    const specs: [string, string[]][] = [
      [a, ["Bej / 45 x 25", "Bej / 50 x 50", "Krom / 45 x 25"]],
      [b, ["Bej / 45 x 25", "bej / 50 x 50", "Krom / 45 x 25", "Bej"]],
    ];
    const ids: Record<string, string> = {};
    for (const [i, [title, vals]] of specs.entries()) {
      await openAdmin(page);
      await createProductViaForm(page, { title, category: "Kristal", price: String(1000 + i), colors: vals.map((_, j) => ({ name: `E2E Ad ${tag} ${j}` })) });
      await expect.poll(() => dialogs.filter((d) => d.includes("vitrine eklendi")).length, { timeout: 60_000 }).toBe(i + 1);
      const id = (await productIdByTitle(title))!;
      expect(id, "ürün oluştu").toBeTruthy();
      ids[title] = id;
      for (const [pos, v] of vals.entries()) {
        // Barkod: ad değişse de DEĞİŞMEMELİ (Trendyol eşleştirmesi yalnızca barkodla)
        await exec(`update "ProductVariation" set "variationType" = 'Seçenek', "variationValue" = $1, "barcode" = $2 where "productId" = $3 and "position" = $4`, [v, `E2EBC-${tag}-${i}-${pos}`, id, pos]);
      }
      await exec(`update "Product" set "category" = $1 where id = $2`, [catName, id]);
      await refreshStorefront(request, id);
    }
    const snapshotOf = (id: string) => rows<{ variationValue: string; variationType: string; barcode: string; stock: number; extraPrice: number; position: number }>(
      `select "variationValue", "variationType", barcode, stock, "extraPrice", position from "ProductVariation" where "productId" = $1 order by position`, [id]);
    const valuesOf = async (id: string) => (await snapshotOf(id)).map((r) => r.variationValue);
    const beforeA = await snapshotOf(ids[a]);
    const beforeB = await snapshotOf(ids[b]);
    const mute = (rs: Awaited<ReturnType<typeof snapshotOf>>) => rs.map(({ variationValue: _v, ...rest }) => rest); // ad dışındaki alanlar

    const openEditor = async (title: string) => {
      await openAdmin(page);
      await findInProductList(page, title);
      await page.locator(`#ap-${ids[title]}`).getByRole("button", { name: /Düzenle/ }).click();
      // Düzenleyici, tam görseller (GET ?fields=images) gelince açılır: Ebat kutusu görünene kadar beklenir
      await expect(page.locator(`#ap-${ids[title]}`).getByLabel("Ebat", { exact: true })).toBeVisible({ timeout: 30_000 });
      return page.locator(`#ap-${ids[title]}`);
    };
    const lastDialog = async (before: number) => {
      await expect.poll(() => dialogs.length, { timeout: 30_000 }).toBeGreaterThan(before);
      return dialogs[dialogs.length - 1];
    };

    // ---- Tek ad ----
    let card = await openEditor(a);
    await card.getByRole("button", { name: "Bej / 45 x 25 adını düzenle" }).click();
    let box = card.getByTestId("ad-duzenle");
    const input = box.getByLabel("Varyasyon adı");
    const save = box.getByRole("button", { name: "Adı kaydet" });

    // Engeller: kaydet düğmesi kapalı, Türkçe hata
    const blocked: [string, RegExp][] = [
      ["", /boş/],
      ["x".repeat(61), /60/],
      ["Bej - 58 x 58", /Biçim tanınmıyor/],
      ["58 x 58 / Bej", /Biçim tanınmıyor/],
      ["Bej / 58 x 58 cm", /Ebat geçerli değil/],
      ["Bej / 58", /Ebat geçerli değil/],
      ["Bej / 58 x 58 / 3 / 4", /Biçim tanınmıyor/],
      ["krom/45x25", /zaten var/], // başka varyasyonla çakışma (büyük/küçük harf farkı gözetmeden)
      ["KROM / 45 X 25", /zaten var/],
    ];
    for (const [text, msg] of blocked) {
      await input.fill(text);
      await expect(box.getByTestId("ad-hata")).toContainText(msg);
      await expect(save).toBeDisabled();
    }

    // Canlı önizleme + uyarı (renk izin listesinde yok) + açık onay
    await input.fill("zümrüt/58x58");
    await expect(box.getByTestId("ad-onizleme")).toContainText("Filtre bunu şöyle okuyacak: Renk yok, Ebat 58 x 58");
    await expect(box.getByTestId("ad-onizleme")).toContainText("Kaydedilecek ad: Zümrüt / 58 x 58");
    await expect(box.getByTestId("uyari")).toContainText("izin listesinde yok");
    await expect(save).toBeDisabled();
    if (SHOT) {
      for (const [n, w, h] of [["1280", 1280, 800], ["390", 390, 844]] as const) {
        await page.setViewportSize({ width: w, height: h });
        for (const t of ["light", "dark"]) {
          await page.evaluate((th) => document.documentElement.classList.toggle("dark", th === "dark"), t);
          await box.scrollIntoViewIfNeeded();
          await box.screenshot({ path: `${SHOT}/ad-duzenle-uyari-${n}-${t}.png` });
        }
      }
      await page.evaluate(() => document.documentElement.classList.remove("dark"));
      await page.setViewportSize({ width: 1280, height: 800 });
    }
    const n0 = dialogs.length;
    await box.getByRole("checkbox", { name: /Yine de kaydet/ }).check();
    await expect(save).toBeEnabled();
    await save.click();
    expect(await lastDialog(n0)).toMatch(/Varyasyon adı kaydedildi/);
    expect(await valuesOf(ids[a])).toEqual(["Zümrüt / 58 x 58", "Bej / 50 x 50", "Krom / 45 x 25"]);
    // Barkod, tür, stok, ek fiyat, sıra dokunulmadı
    expect(mute(await snapshotOf(ids[a]))).toEqual(mute(beforeA));

    // Geri Al: eski ad
    await page.getByRole("button", { name: /Son İşlemi Geri Al/ }).click();
    await expect.poll(() => valuesOf(ids[a]), { timeout: 30_000 }).toEqual(["Bej / 45 x 25", "Bej / 50 x 50", "Krom / 45 x 25"]);

    // Uyarısız geçerli ad (izin listesinde, ebat var): onay kutusu yok
    card = await openEditor(a);
    await card.getByRole("button", { name: "Bej / 50 x 50 adını düzenle" }).click();
    box = card.getByTestId("ad-duzenle");
    await box.getByLabel("Varyasyon adı").fill("gold/50x50");
    await expect(box.getByTestId("ad-onizleme")).toContainText("Renk Gold, Ebat 50 x 50");
    await expect(box.getByTestId("uyari")).toHaveCount(0);
    const n2 = dialogs.length;
    await box.getByRole("button", { name: "Adı kaydet" }).click();
    expect(await lastDialog(n2)).toMatch(/kaydedildi/);
    expect(await valuesOf(ids[a])).toEqual(["Bej / 45 x 25", "Gold / 50 x 50", "Krom / 45 x 25"]);

    // Sunucu doğrulaması ZORUNLU: arayüz atlanarak gönderilen geçersiz/uyarılı istekler reddedilir
    const [v0] = await rows<{ id: string }>(`select id from "ProductVariation" where "productId" = $1 and position = 0`, [ids[a]]);
    const bad = await request.patch("/api/admin/product/variation", { data: { variationId: v0.id, variationValue: "Bej - 58 x 58" } });
    expect(bad.status()).toBe(400);
    const dup = await request.patch("/api/admin/product/variation", { data: { variationId: v0.id, variationValue: "krom/45x25" } });
    expect(dup.status()).toBe(400);
    const warn = await request.patch("/api/admin/product/variation", { data: { variationId: v0.id, variationValue: "Zümrüt / 58 x 58" } });
    expect(warn.status()).toBe(409);
    expect((await warn.json()).needsConfirm).toBe(true);
    expect(await valuesOf(ids[a])).toEqual(["Bej / 45 x 25", "Gold / 50 x 50", "Krom / 45 x 25"]);

    // ---- Toplu renk (ürün B) ----
    card = await openEditor(b);
    const bulk = card.getByTestId("toplu-renk");
    await bulk.getByLabel("Eski renk").selectOption("Bej"); // 3 varyasyon "Bej" (büyük/küçük harf farkı tek giriş)
    await expect(bulk.getByLabel("Eski renk").locator("option")).toHaveText(["Seçin…", "Bej", "Krom"]);
    // Çakışma engeli: Bej → Krom, "Krom / 45 x 25" ile aynı ad oluşturur; iki ad da yazılır, Uygula yok
    await bulk.getByLabel("Yeni renk (toplu)").fill("krom");
    await bulk.getByRole("button", { name: "Önizle" }).click();
    await expect(bulk.getByTestId("toplu-hata")).toContainText(/Çakışma: "[^"]+" ve "[^"]+" aynı ad olur/);
    await expect(bulk.getByTestId("toplu-hata")).toContainText("Krom / 45 x 25");
    await expect(bulk.getByRole("button", { name: "Uygula" })).toHaveCount(0);

    // Tanınmayan yeni renk: uyarı + onay; sonra izinli renk (Gold) uygulanır
    const bulk3 = bulk;
    await bulk3.getByLabel("Yeni renk (toplu)").fill("zümrüt");
    await bulk3.getByRole("button", { name: "Önizle" }).click();
    await expect(bulk3.getByTestId("uyari")).toContainText("izin listesinde yok");
    await expect(bulk3.getByRole("button", { name: "Uygula" })).toBeDisabled();
    await bulk3.getByLabel("Yeni renk (toplu)").fill("gold");
    await expect(bulk3.getByTestId("toplu-onizleme")).toHaveCount(0); // girdi değişince önizleme sıfırlanır
    await bulk3.getByRole("button", { name: "Önizle" }).click();
    const pv = bulk3.getByTestId("toplu-onizleme");
    await expect(pv).toContainText("3 varyasyon değişecek");
    await expect(pv).toContainText("Gold / 45 x 25");
    await expect(pv).toContainText("Gold / 50 x 50"); // küçük harfli "bej / 50 x 50" → ebat korunur
    await expect(pv).toContainText("Renk Gold, Ebat 45 x 25");
    await expect(bulk3.getByTestId("uyari")).toHaveCount(0);
    if (SHOT) {
      for (const [n, w, h] of [["1280", 1280, 800], ["390", 390, 844]] as const) {
        await page.setViewportSize({ width: w, height: h });
        for (const t of ["light", "dark"]) {
          await page.evaluate((th) => document.documentElement.classList.toggle("dark", th === "dark"), t);
          await bulk3.scrollIntoViewIfNeeded();
          await bulk3.screenshot({ path: `${SHOT}/toplu-renk-onizleme-${n}-${t}.png` });
        }
      }
      await page.evaluate(() => document.documentElement.classList.remove("dark"));
      await page.setViewportSize({ width: 1280, height: 800 });
    }
    const n3 = dialogs.length;
    await bulk3.getByRole("button", { name: "Uygula" }).click();
    expect(await lastDialog(n3)).toMatch(/toplu değiştirildi/);
    expect(await valuesOf(ids[b])).toEqual(["Gold / 45 x 25", "Gold / 50 x 50", "Krom / 45 x 25", "Gold"]);
    expect(mute(await snapshotOf(ids[b]))).toEqual(mute(beforeB)); // barkod/tür/stok/fiyat/sıra aynı

    // ---- Vitrin: yeni renk filtrede, eski renk yok (önbellek temizlendi) ----
    const labels = async (name: "renk" | "ebat") => {
      await page.goto(`${LIST}`, { waitUntil: "domcontentloaded" });
      return page.locator(`#filtre-paneli input[name="${name}"]`).evaluateAll((els) => els.map((e) => e.getAttribute("value") ?? ""));
    };
    await expect.poll(() => labels("renk"), { timeout: 90_000, intervals: [1000, 3000, 6000] }).toEqual(expect.arrayContaining(["gold", "krom"]));
    const colors = await labels("renk");
    // Eski renk B'den kalktı (A'nın Bej varyasyonu duruyor), yeni renk B'de
    const titlesOf = async (q: string) => {
      await page.goto(`${LIST}&${q}`, { waitUntil: "domcontentloaded" });
      return (await page.locator("main div.group h3").allInnerTexts()).filter((t) => t.startsWith(PREFIX)).sort();
    };
    expect(colors).toContain("bej");
    expect(await titlesOf("renk=bej")).toEqual([a]);
    expect(await titlesOf("renk=gold")).toEqual([a, b].sort());
    expect(await labels("ebat")).toEqual(expect.arrayContaining(["45x25", "50x50"]));

    // ---- Toplu renk Geri Al ----
    // Geri Al çubuğu sayfa yenilenince kaybolur: toplu işlemi yeniden yapıp aynı sayfada geri al
    card = await openEditor(b);
    const bulk4 = card.getByTestId("toplu-renk");
    await bulk4.getByLabel("Eski renk").selectOption("Gold");
    await bulk4.getByLabel("Yeni renk (toplu)").fill("Bej");
    await bulk4.getByRole("button", { name: "Önizle" }).click();
    await expect(bulk4.getByTestId("toplu-onizleme")).toContainText("3 varyasyon değişecek");
    const n4 = dialogs.length;
    await bulk4.getByRole("button", { name: "Uygula" }).click();
    expect(await lastDialog(n4)).toMatch(/toplu değiştirildi/);
    expect(await valuesOf(ids[b])).toEqual(["Bej / 45 x 25", "Bej / 50 x 50", "Krom / 45 x 25", "Bej"]);
    await page.getByRole("button", { name: /Son İşlemi Geri Al/ }).click();
    await expect.poll(() => valuesOf(ids[b]), { timeout: 30_000 }).toEqual(["Gold / 45 x 25", "Gold / 50 x 50", "Krom / 45 x 25", "Gold"]);

    // ---- Mobil (390): taşma yok, 16 px giriş, dokunma hedefi >= 40 px ----
    await page.setViewportSize({ width: 390, height: 844 });
    card = await openEditor(a);
    await card.getByRole("button", { name: "Bej / 45 x 25 adını düzenle" }).click();
    box = card.getByTestId("ad-duzenle");
    await box.getByLabel("Varyasyon adı").fill("zümrüt/58x58");
    await expect(box.getByTestId("uyari")).toBeVisible();
    expect(await box.getByLabel("Varyasyon adı").evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
    for (const btn of [box.getByRole("button", { name: "Adı kaydet" }), box.getByRole("button", { name: "Vazgeç" })]) {
      expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(40);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    card = await openEditor(b);
    const bulk5 = card.getByTestId("toplu-renk");
    await bulk5.getByLabel("Eski renk").selectOption("Gold");
    await bulk5.getByLabel("Yeni renk (toplu)").fill("Bej");
    await bulk5.getByRole("button", { name: "Önizle" }).click();
    await expect(bulk5.getByTestId("toplu-onizleme")).toBeVisible();
    expect(await bulk5.getByLabel("Yeni renk (toplu)").evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("Trendyol: 'Varyasyon adı' satırında Ezerek seçilince uyarı görünür (yazmaz, dış çağrı yok)", async ({ page }) => {
    await openAdmin(page);
    await expandPanel(page, /Trendyol Ürünleri/);
    const label = "Varyasyon adı ve stok kodu (renk / ebat adı dahil)";
    const radio = (mode: string) => page.getByRole("radio", { name: `${label}: ${mode}`, exact: true });
    const warn = page.getByText("\"Trendyol'daki değeri yaz\" seçersen elle düzelttiğin renk ve ebat adları Trendyol'daki hâline geri döner.");
    await expect(radio("Dokunma")).toBeChecked();
    await expect(warn).toHaveCount(0);
    await radio("Trendyol'daki değeri yaz").check();
    await expect(warn).toBeVisible();
    if (SHOT) {
      for (const [n, w, h] of [["1280", 1280, 800], ["390", 390, 844]] as const) {
        await page.setViewportSize({ width: w, height: h });
        for (const t of ["light", "dark"]) {
          await page.evaluate((th) => document.documentElement.classList.toggle("dark", th === "dark"), t);
          await warn.scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${SHOT}/trendyol-ezerek-uyari-${n}-${t}.png` });
        }
      }
      await page.evaluate(() => document.documentElement.classList.remove("dark"));
      await page.setViewportSize({ width: 1280, height: 800 });
    }
    await radio("Elle değiştirdiklerimi koru").check();
    await expect(warn).toHaveCount(0);
    await radio("Trendyol'daki değeri yaz").check();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 800 });
  });
});
