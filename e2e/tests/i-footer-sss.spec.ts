import { test, expect, openOk } from "../fixtures";

test.describe("i) Alt bilgi SSS bağlantısı", () => {
  test("başka sayfadan 'Sık Sorulan Sorular' ana sayfadaki SSS bölümüne götürür", async ({ page }) => {
    await openOk(page, "/iletisim");
    const link = page.locator("footer").getByRole("link", { name: "Sık Sorulan Sorular" });
    await expect(link).toHaveAttribute("href", "/#sss-baslik");
    await link.click();
    await expect(page).toHaveURL(/\/#sss-baslik$/);
    await expect(page.locator("#sss-baslik")).toBeInViewport();
    await expect(page.locator("#sss-baslik")).toHaveText(/Kargolama, Garanti/);
    // Sabit menü başlığı örtmemeli: kaydırma bitince başlığın üstü menünün altında olmalı (gerçek konum ölçümü)
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const h = document.querySelector("#sss-baslik")!.getBoundingClientRect().top;
          const bar = document.querySelector("header")!.getBoundingClientRect().bottom;
          return h >= bar;
        })
      )
      .toBe(true);
  });
});
