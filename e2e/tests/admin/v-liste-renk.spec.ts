import { test, expect } from "../../fixtures";
import { autoDialogs, cleanupE2eProducts, createProductViaForm, openAdmin, uniq } from "../../admin-helpers";

const PREFIX = "E2E Liste Renk";

// Renk filtresi yalnızca yönetimin yazdığı "Renk" varyasyonlarıyla kurulur; yinelenen adlar ("Bej" / "Bej (0146)") tek seçenekte birleşir.
test.describe("Admin: ortak liste renk filtresi (E2E önekli veri, sonda silinir)", () => {
  test.afterAll(async ({ request }) => {
    await cleanupE2eProducts(request, PREFIX);
  });

  test("yinelenen renk adları birleşir, sayılar ve sonuçlar tutarlı", async ({ page }) => {
    const tag = uniq();
    const a = `${PREFIX} A ${tag}`;
    const b = `${PREFIX} B ${tag}`;
    const dialogs = autoDialogs(page);

    for (const [title, colors, price] of [
      [a, [{ name: "E2Erenk Bej (0146)" }, { name: "E2Erenk Gold" }], "1111"],
      [b, [{ name: "E2Erenk Bej" }], "2222"],
    ] as const) {
      await openAdmin(page);
      await createProductViaForm(page, { title, category: "Kristal", price, colors: [...colors] });
      await expect.poll(() => dialogs.filter((d) => d.includes("vitrine eklendi")).length, { timeout: 60_000 }).toBe(title === a ? 1 : 2);
    }

    // Vitrin önbelleği (60 sn, "eskiyi sun") için yenileyerek bekle
    const open = async (q: string) => {
      await page.goto(`/kategori/kristal?adet=tumu&${q}`, { waitUntil: "domcontentloaded" });
      return page.getByTestId("urun-sayisi").locator("strong").innerText();
    };
    await expect
      .poll(async () => (await open("renk=e2erenk-bej")) === "2", { timeout: 90_000, intervals: [2000, 4000, 8000] })
      .toBe(true);

    const labels = await page.locator('#filtre-paneli input[name="renk"]').evaluateAll((els) =>
      els.map((e) => ({ v: e.getAttribute("value") ?? "", t: (e.closest("label")?.textContent ?? "").replace(/\s+/g, " ").trim() }))
    );
    const bej = labels.find((l) => l.v === "e2erenk-bej");
    expect(bej?.t, "birleşik renk etiketi").toMatch(/^E2Erenk Bej\s*\(2\)$/);
    expect(labels.some((l) => /0146/.test(l.t)), "kod ekli ad ayrı seçenek olmamalı").toBe(false);
    expect(labels.find((l) => l.v === "e2erenk-gold")?.t).toMatch(/\(1\)$/);

    // sonuçlar: bej → A ve B; gold → yalnızca A; ikisi birlikte (VEYA) → A ve B
    const titles = async (q: string) => {
      await open(q);
      return page.locator("main div.group h3").allInnerTexts();
    };
    expect((await titles("renk=e2erenk-bej")).sort()).toEqual([a, b].sort());
    expect(await titles("renk=e2erenk-gold")).toEqual([a]);
    expect((await titles("renk=e2erenk-bej,e2erenk-gold")).sort()).toEqual([a, b].sort());
    // renk + fiyat birlikte
    expect(await titles("renk=e2erenk-bej&fiyat_min=2000")).toEqual([b]);
  });
});
