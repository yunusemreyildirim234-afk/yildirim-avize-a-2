import { test, expect, openOk } from "../../fixtures";

// Zil bileşeni müşteri ucunu (/api/notifications) yoklar; yönetici oturumunda da aynı bileşen görünür.
// Ağ taslaklanır (veritabanına gitmez), sayaç yalnızca GET isteklerini sayar. Sekme gizliliği document.hidden ile taklit edilir, 30 sn'lik aralık sahte saatle ilerletilir.
test.describe("Bildirim yoklaması sekme görünürlüğü", () => {
  test("sekme gizliyken istek gitmez; görünür olunca hemen bir kez gider ve yoklama sürer", async ({ page }) => {
    let hits = 0;
    await page.route("**/api/notifications", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      hits++;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], unread: 0 }) });
    });
    await page.addInitScript(() => {
      const w = window as unknown as { __hidden: boolean };
      w.__hidden = false;
      Object.defineProperty(document, "hidden", { configurable: true, get: () => w.__hidden });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (w.__hidden ? "hidden" : "visible") });
    });
    const setHidden = (hidden: boolean) =>
      page.evaluate((h) => {
        (window as unknown as { __hidden: boolean }).__hidden = h;
        document.dispatchEvent(new Event("visibilitychange"));
      }, hidden);

    await page.clock.install();
    await openOk(page, "/");
    await expect.poll(() => hits).toBe(1); // ilk yükleme

    await setHidden(true);
    await page.clock.runFor(95_000); // üç yoklama aralığı
    expect(hits, "gizli sekmede istek gitmemeli").toBe(1);

    await setHidden(false);
    await expect.poll(() => hits, "görünür olunca hemen yenilenmeli").toBe(2);

    await page.clock.runFor(31_000);
    await expect.poll(() => hits, "yoklama devam etmeli").toBe(3);
  });
});
