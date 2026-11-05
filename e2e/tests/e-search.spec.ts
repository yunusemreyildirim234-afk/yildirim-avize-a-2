import { test, expect, openOk } from "../fixtures";

async function count(request: import("@playwright/test").APIRequestContext, q: string): Promise<{ n: number; ids: string[] }> {
  const res = await request.get(`/api/search?q=${encodeURIComponent(q)}`);
  expect(res.status(), `arama "${q}"`).toBe(200);
  const body = (await res.json()) as { products: { id: string }[] };
  return { n: body.products.length, ids: body.products.map((p) => p.id).sort() };
}

test.describe("e) Arama (salt okunur)", () => {
  test('"avize" ve "AVİZE" aynı sonuç sayısını verir', async ({ request }) => {
    const a = await count(request, "avize");
    const b = await count(request, "AVİZE");
    expect(b.n, 'büyük harf/İ ile aranan sonuç sayısı küçük harfliyle aynı olmalı').toBe(a.n);
    expect(b.ids).toEqual(a.ids);
  });

  test('"Kontes" ve "KONTES" aynı sonuç sayısını verir', async ({ request }) => {
    const a = await count(request, "Kontes");
    const b = await count(request, "KONTES");
    expect(b.n).toBe(a.n);
    expect(b.ids).toEqual(a.ids);
  });

  test("dört yazım biçimi birlikte tutarlı", async ({ request }) => {
    const sizes = await Promise.all(["avize", "AVİZE", "Kontes", "KONTES"].map((q) => count(request, q).then((r) => r.n)));
    test.info().annotations.push({ type: "sonuc-sayilari", description: `avize=${sizes[0]} AVİZE=${sizes[1]} Kontes=${sizes[2]} KONTES=${sizes[3]}` });
    expect(sizes[0]).toBe(sizes[1]);
    expect(sizes[2]).toBe(sizes[3]);
  });

  test("arama kutusu sonuç listesini gösterir", async ({ page }, info) => {
    await openOk(page, "/");
    if (info.project.name === "mobile") await page.getByRole("button", { name: "Ürün ara" }).first().click();
    const input = page.getByLabel("Ürün adı, model kodu veya stok kodu ile ara").last();
    await input.fill("avize");
    const list = page.getByRole("listbox", { name: "Arama sonuçları" });
    const none = page.getByText(/bulunamadı|sonuç yok/i);
    await expect(list.or(none).first()).toBeVisible();
  });
});
