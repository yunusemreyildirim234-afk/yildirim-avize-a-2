import { test, expect } from "../../fixtures";
import { rows } from "../../db";
import { CUSTOMER, acceptAgreements, cartItem, chooseDelivery, choosePayment, fillCustomer, newGuest, submitButton, type GuestSession } from "../../order-helpers";

// Doğrulama testleri: SİPARİŞ OLUŞMAZ. /api/order istekleri tarayıcıda taklit edilir ve sayılır (sunucuya ulaşmaz; hız sınırı yenmez).
// Sepete yalnızca YERİNDE okunan gerçek bir ürün konur (yalnızca localStorage; veritabanına yazılmaz, E2E dışı ürün değiştirilmez).
interface Real {
  productId: string;
  variationId: string;
  title: string;
  variationName: string;
  price: number;
}

async function realInStock(): Promise<Real | null> {
  const r = await rows<{ pid: string; vid: string; title: string; vt: string; vv: string; price: number }>(
    `select p.id as pid, v.id as vid, p.title, v."variationType" as vt, v."variationValue" as vv, (p."basePrice" + v."extraPrice") as price
       from "ProductVariation" v join "Product" p on p.id = v."productId"
      where p.active and v.stock >= 5 and p.title not ilike 'E2E %' order by p."createdAt" desc limit 1`
  );
  return r[0] ? { productId: r[0].pid, variationId: r[0].vid, title: r[0].title, variationName: `${r[0].vt}: ${r[0].vv}`, price: Number(r[0].price) } : null;
}

test.describe("Ödeme doğrulamaları (sipariş oluşmaz)", () => {
  let real: Real | null = null;
  test.beforeAll(async () => {
    real = await realInStock();
  });

  async function open(browser: Parameters<typeof newGuest>[0], baseURL: string, withCart: boolean) {
    const g = await newGuest(browser, baseURL, { cart: withCart && real ? [cartItem({ ...real, quantity: 1 })] : [] });
    const calls: string[] = [];
    await g.page.route("**/api/order", (route) => {
      calls.push(route.request().postData() ?? "");
      return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "e2e taslağı: sunucuya gitmedi" }) });
    });
    return { g, calls };
  }
  const done = async (g: GuestSession) => {
    expect(g.serverErrors).toEqual([]);
    await g.ctx.close();
  };

  test("sepet boşken ödeme adımı açılmaz", async ({ browser, baseURL }) => {
    const { g, calls } = await open(browser, baseURL!, false);
    await g.page.goto("/sepet", { waitUntil: "domcontentloaded" });
    await expect(g.page.getByText("Sepetiniz Henüz Boş")).toBeVisible();
    await expect(submitButton(g.page)).toHaveCount(0);
    await expect(g.page.getByLabel("E-posta Adresiniz")).toHaveCount(0);
    await expect(g.page.getByRole("link", { name: /Koleksiyonu İncele/ })).toBeVisible();
    expect(calls).toHaveLength(0);
    await done(g);
  });

  test("zorunlu alanlar boşken form hata gösterir ve istek gitmez; sözleşme onayı olmadan düğme kapalı", async ({ browser, baseURL }) => {
    test.skip(!real, "e2e veritabanında stoklu gerçek ürün yok");
    const { g, calls } = await open(browser, baseURL!, true);
    const { page } = g;
    await page.goto("/sepet", { waitUntil: "domcontentloaded" });
    await chooseDelivery(page, "kargo");
    await choosePayment(page, "havale");
    await expect(submitButton(page)).toBeDisabled(); // sözleşmeler işaretli değil
    await acceptAgreements(page);
    await expect(submitButton(page)).toBeEnabled();
    const fields = [page.getByLabel(/Adınız Soyadınız/), page.getByLabel("E-posta Adresiniz"), page.getByLabel(/Telefon Numaranız/), page.getByLabel(/Açık Teslimat Adresiniz/)];
    for (const f of fields) expect(await f.evaluate((el) => (el as HTMLInputElement).validity.valueMissing), "zorunlu alan boş").toBe(true);
    await submitButton(page).click();
    // Tarayıcı doğrulaması ilk geçersiz alana odaklanır ve sipariş isteği gitmez
    await expect(fields[0]).toBeFocused();
    expect(await fields[0].evaluate((el) => el.matches(":invalid"))).toBe(true);
    expect(calls).toHaveLength(0);
    // Mağazadan teslimde adres istenmez
    await chooseDelivery(page, "magaza");
    await expect(fields[3]).toHaveCount(0);
    await done(g);
  });

  test("geçersiz e-posta biçimi reddedilir ve istek gitmez", async ({ browser, baseURL }) => {
    test.skip(!real, "e2e veritabanında stoklu gerçek ürün yok");
    const { g, calls } = await open(browser, baseURL!, true);
    const { page } = g;
    await page.goto("/sepet", { waitUntil: "domcontentloaded" });
    await chooseDelivery(page, "magaza");
    await choosePayment(page, "havale");
    await fillCustomer(page, { ...CUSTOMER, email: "bu-bir-eposta-degil" }, { address: false });
    await acceptAgreements(page);
    await expect(submitButton(page)).toBeEnabled();
    const email = page.getByLabel("E-posta Adresiniz");
    expect(await email.evaluate((el) => (el as HTMLInputElement).validity.typeMismatch)).toBe(true);
    await submitButton(page).click();
    await expect(email).toBeFocused();
    expect(calls).toHaveLength(0);
    await done(g);
  });

  test("geçersiz telefon (harfler) form hatası verir ve istek gitmez", async ({ browser, baseURL }) => {
    // BULGU: telefon alanı yalnızca type="tel" ve required; biçim doğrulaması yok (sunucu da yalnızca uzunluğa bakar). "abc" geçerek sunucuya gider.
    test.fail(true, "BULGU: telefon biçimi hiçbir yerde doğrulanmıyor (istemci ve sunucu yalnızca doluluk/uzunluk denetler)");
    test.skip(!real, "e2e veritabanında stoklu gerçek ürün yok");
    const { g, calls } = await open(browser, baseURL!, true);
    const { page } = g;
    await page.goto("/sepet", { waitUntil: "domcontentloaded" });
    await chooseDelivery(page, "magaza");
    await choosePayment(page, "havale");
    await fillCustomer(page, { ...CUSTOMER, phone: "abc" }, { address: false });
    await acceptAgreements(page);
    await expect(submitButton(page)).toBeEnabled();
    await submitButton(page).click();
    await page.waitForTimeout(1500);
    expect(calls, "geçersiz telefonla sipariş isteği gitmemeli").toHaveLength(0);
    await done(g);
  });

  test.skip("sunucu tarafı doğrulamalar (/api/order 400 yanıtları: eksik alan, geçersiz e-posta, onay yok, boş sepet)", () => {
    // Bilerek atlandı: /api/order hız sınırı (bellek içi, 10 dk'da 5 istek) başarısız istekleri de sayar; p-siparis 4 isteği kullanır.
    // İstemci doğrulaması yukarıda sınanır; sunucu 400'leri hız sınırı yükseltilmeden/ayrı sunucu süreciyle ayrı işte sınanmalıdır.
  });
});
