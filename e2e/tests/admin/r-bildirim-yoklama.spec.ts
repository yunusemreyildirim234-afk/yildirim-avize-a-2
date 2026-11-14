import { test, expect, openOk } from "../../fixtures";

// Zil bileşeni artık liste yerine hafif ÖZET ucunu (/api/notifications?...&ozet=1) yoklar; müşteri tarafında zamanlayıcı yoktur.
// Ağ taslaklanır (veritabanına gitmez), sayaç yalnızca özet GET isteklerini sayar. Sekme gizliliği document.hidden ile taklit edilir, süre sahte saatle ilerletilir.
test.describe("Bildirim özet yoklaması sekme görünürlüğü", () => {
  test("sekme gizliyken istek gitmez; görünür olunca bir kez gider; müşteri tarafında zamanlayıcı yoktur", async ({ page }) => {
    let hits = 0;
    let fullListHits = 0;
    await page.route("**/api/notifications**", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      if (!route.request().url().includes("ozet=1")) {
        fullListHits++;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], unread: 0 }) });
      }
      hits++;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ unread: 0, latest: null }) });
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
    await expect.poll(() => hits).toBe(1); // ilk yükleme: yalnız özet

    await setHidden(true);
    await page.clock.runFor(200_000);
    expect(hits, "gizli sekmede istek gitmemeli").toBe(1);

    await setHidden(false);
    await expect.poll(() => hits, "görünür olunca bir kez yenilenmeli").toBe(2);

    await page.clock.runFor(200_000);
    expect(hits, "müşteri tarafında zamanlayıcı yok: süre geçince ek istek gitmemeli").toBe(2);
    expect(fullListHits, "tam liste yalnız zil açılınca ya da özet değişince istenir").toBe(0);
  });
});
