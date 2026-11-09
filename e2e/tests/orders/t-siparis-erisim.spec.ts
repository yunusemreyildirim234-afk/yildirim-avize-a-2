import { test, expect } from "../../fixtures";
import { uniq } from "../../admin-helpers";
import { newGuest } from "../../order-helpers";
import { PREFIX, cleanupHardening, clientHeaders, createProduct, dbNow, memberToken, seedOrder, seedUser } from "../../hardening-helpers";

// /kargo-takip (UUID gizliliği, hız sınırı) ve /siparis-onay (tam / kısıtlı görünüm). Sipariş tarihleri veride geriye alınır.
test.describe.configure({ mode: "serial" });

const NOTE = "E2E gizli sipariş notu";

test.describe("Sipariş sayfalarına erişim", () => {
  const sfx = uniq();
  const title = `${PREFIX} Erisim ${sfx}`;
  const barcode = `E2EBARKOD${sfx}`.toUpperCase();
  const tracking = `E2ETAKIP${sfx}`.toUpperCase();
  let since = "";
  let guestFresh = "";
  let guestOld = "";
  let guestOldBank = "";
  let guestFreshBank = "";
  let memberOrder = "";
  let memberId = "";
  let strangerId = "";

  test.afterAll(async ({ request }) => {
    await cleanupHardening(request, since).catch((e) => console.error("[t-erisim] temizlik:", (e as Error).message));
  });

  test("hazırlık: ürün, misafir ve üye siparişleri", async ({ page }) => {
    since = await dbNow();
    const { variation } = await createProduct(page, title, 5);
    const item = { variationId: variation.id, quantity: 1 };
    const guestId = await seedUser(`e2e-erisim-${sfx}@example.invalid`, "E2E Müşteri");
    memberId = await seedUser(`e2e-uye-${sfx}@example.invalid`, "E2E Üye", "e2e-hash-degil");
    strangerId = await seedUser(`e2e-yabanci-${sfx}@example.invalid`, "E2E Yabancı", "e2e-hash-degil");
    const base = { status: "PENDING", paymentMethod: "CREDIT_CARD" as const, phone: "0500 000 50 01", orderNote: NOTE, barcode, item };
    guestFresh = await seedOrder({ ...base, userId: guestId, ageHours: 23 });
    guestOld = await seedOrder({ ...base, userId: guestId, ageHours: 25, tracking });
    guestOldBank = await seedOrder({ userId: guestId, status: "PENDING_NEW", paymentMethod: "BANK_TRANSFER", phone: "0500 000 50 02", ageHours: 25, orderNote: NOTE, item });
    guestFreshBank = await seedOrder({ userId: guestId, status: "PENDING_NEW", paymentMethod: "BANK_TRANSFER", phone: "0500 000 50 03", ageHours: 1, item });
    memberOrder = await seedOrder({ ...base, userId: memberId, ageHours: 100 });
  });

  test("(e) takip kodu ve barkodla sorguda UUID ve onay bağlantısı yok; durum ve maskeli ad var", async ({ request }) => {
    for (const code of [tracking, barcode]) {
      const html = await (await request.get(`/kargo-takip?code=${code}`, { headers: clientHeaders(20) })).text();
      expect(html, code).toMatch(/E2E (M|Ü)\./); // barkod misafir ve üye siparişlerinde ortak; hangisi bulunursa ad maskeli olmalı
      expect(html).toContain("Hazırlanıyor");
      expect(html).not.toContain(guestOld);
      expect(html).not.toContain(guestFresh);
      expect(html).not.toContain("/siparis-onay");
    }
    // Sipariş numarasını zaten bilen sorguda gösterilir
    expect(await (await request.get(`/kargo-takip?code=${guestOld}`, { headers: clientHeaders(20) })).text()).toContain(guestOld);
  });

  test("(e) kargo-takip hız sınırı: IP başına 20 sorgu, kod yokken sayılmaz", async ({ request }) => {
    const headers = clientHeaders(21);
    const LIMIT_TEXT = "çok fazla sorgu";
    for (let i = 0; i < 3; i++) expect(await (await request.get("/kargo-takip", { headers })).text()).not.toContain(LIMIT_TEXT);
    for (let i = 0; i < 20; i++) {
      expect(await (await request.get(`/kargo-takip?code=E2E-YOK-${i}`, { headers })).text(), `sorgu ${i + 1}`).not.toContain(LIMIT_TEXT);
    }
    expect(await (await request.get("/kargo-takip?code=E2E-YOK-21", { headers })).text()).toContain(LIMIT_TEXT);
    expect(await (await request.get("/kargo-takip?code=E2E-YOK-22", { headers: clientHeaders(22) })).text(), "başka IP etkilenmez").not.toContain(LIMIT_TEXT);
  });

  async function view(browser: import("@playwright/test").Browser, baseURL: string, orderId: string, sessionUserId?: string) {
    const g = await newGuest(browser, baseURL);
    try {
      if (sessionUserId) await g.ctx.addCookies([{ name: "ya_user", value: memberToken(sessionUserId), url: baseURL }]);
      const res = await g.page.goto(`/siparis-onay/${orderId}`, { waitUntil: "domcontentloaded" });
      expect(res!.status(), "kısıtlı görünümde de 404 yok").toBe(200);
      // loading.tsx iskeleti önce gelir: sayfanın gerçek içeriği beklenir
      await g.page.getByTestId("kisitli-gorunum").or(g.page.getByText("Sipariş Takip Kodu:")).waitFor();
      return { restricted: (await g.page.getByTestId("kisitli-gorunum").count()) === 1, main: await g.page.getByRole("main").innerText(), html: await g.page.content() };
    } finally {
      await g.ctx.close();
    }
  }

  const expectFull = (v: Awaited<ReturnType<typeof view>>) => {
    expect(v.restricted).toBe(false);
    for (const s of [title, NOTE, barcode, "1.234,50"]) expect(v.main).toContain(s);
  };
  const expectRestricted = (v: Awaited<ReturnType<typeof view>>, orderId: string) => {
    expect(v.restricted).toBe(true);
    expect(v.main).toContain(orderId);
    expect(v.main).toContain("giriş yapın");
    for (const s of [title, NOTE, barcode, "1.234,50", "E2E Müşteri", "E2E Üye"]) expect(v.html, `kısıtlı görünümde "${s}" olmamalı`).not.toContain(s);
  };

  test("(f) 24 saat içindeki misafir tam görünüm görür", async ({ browser, baseURL }) => {
    expectFull(await view(browser, baseURL!, guestFresh));
  });

  test("(f) oturumlu sahip, sipariş eski olsa da tam görünüm görür", async ({ browser, baseURL }) => {
    expectFull(await view(browser, baseURL!, memberOrder, memberId));
  });

  test("(f) süresi geçmiş misafir, oturumsuz ziyaretçi ve yabancı üye kısıtlı görünüm görür", async ({ browser, baseURL }) => {
    expectRestricted(await view(browser, baseURL!, guestOld), guestOld);
    expectRestricted(await view(browser, baseURL!, memberOrder), memberOrder);
    expectRestricted(await view(browser, baseURL!, memberOrder, strangerId), memberOrder);
    expect((await view(browser, baseURL!, guestOld)).main).toContain("Hazırlanıyor");
  });

  test("süresi geçmiş bekleyen havalede dekont yükleme açık kalır, sipariş detayı ve ad görünmez", async ({ browser, baseURL }) => {
    const v = await view(browser, baseURL!, guestOldBank);
    expectRestricted(v, guestOldBank);
    expect(v.main).toContain("Havale / EFT Bilgileri");
  });

  test("dekont formunda gönderen adı boş başlar", async ({ browser, baseURL }) => {
    for (const id of [guestFreshBank, guestOldBank]) {
      const g = await newGuest(browser, baseURL!);
      try {
        await g.page.goto(`/siparis-onay/${id}`, { waitUntil: "domcontentloaded" });
        await g.page.getByRole("button", { name: /Dekont Yükle/ }).click();
        await expect(g.page.getByPlaceholder("Havaleyi yapan kişinin adı soyadı")).toHaveValue("");
        expect(await g.page.content()).not.toContain("E2E Müşteri");
      } finally {
        await g.ctx.close();
      }
    }
  });
});
