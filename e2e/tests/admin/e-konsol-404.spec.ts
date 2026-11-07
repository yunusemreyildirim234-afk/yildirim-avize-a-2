import { test, expect } from "../../fixtures";
import { openAdmin } from "../../admin-helpers";

// Yönetim sayfası yüklenirken beklenmeyen 404 (eksik ikon/manifest/görsel yolu) olmamalı.
test.describe("Admin: yükleme sırasında 404 kaynak yok", () => {
  test("/admin açılırken 404 yanıtı ve 404 konsol hatası yok", async ({ page, consoleErrors }) => {
    const notFound: string[] = [];
    page.on("response", (r) => {
      if (r.status() === 404) notFound.push(`${r.status()} ${r.request().resourceType()} ${new URL(r.url()).pathname}`);
    });
    await openAdmin(page);
    await page.waitForLoadState("load");
    await page.waitForTimeout(3000); // geç yüklenen görseller / ön getirmeler
    console.log("[404]", JSON.stringify(notFound), "[konsol]", JSON.stringify(consoleErrors));
    expect(notFound, "404 dönen istekler").toEqual([]);
    expect(consoleErrors.filter((e) => /404/.test(e)), "404 konsol hataları").toEqual([]);
  });
});
