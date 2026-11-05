import { test, expect } from "@playwright/test";
import { db } from "../../db";

// Kalıntı denetimi (teardown): yalnızca SELECT. "E2E " önekli ürün/kategori/kupon kalıntısı varsa başarısız olur; silme/yazma yapmaz.
test("E2E kalıntı denetimi (yalnızca SELECT)", async () => {
  await db(async (client) => {
    await client.query("BEGIN READ ONLY"); // salt okunur işlem: yazma sorgusu çalışamaz; sonda ROLLBACK
    const leftovers: string[] = [];
    const products = await client.query(`select title from "Product" where title ilike 'E2E %'`);
    leftovers.push(...products.rows.map((r) => `ürün: ${r.title}`));
    const coupons = await client.query(`select code from "Coupon" where code ilike 'E2E%'`);
    leftovers.push(...coupons.rows.map((r) => `kupon: ${r.code}`));
    const notes = await client.query(`select title from "Notification" where title ilike 'E2E %'`);
    leftovers.push(...notes.rows.map((r) => `bildirim: ${r.title}`));
    const cats = await client.query(`select to_jsonb(s) as j from "SiteConfig" s where id = 1`);
    const cfg = JSON.stringify(cats.rows[0]?.j ?? {});
    for (const m of cfg.match(/e2e[ -][^"\,]*/gi) ?? []) leftovers.push(`kategori/ayar: ${m}`);
    const orphans = await client.query(`select count(*)::int as n from "ProductImage" where "productId" is null`);
    console.log(`[denetim] sahipsiz ürün görseli sayısı (bilgi): ${orphans.rows[0].n}`);
    await client.query("ROLLBACK");
    expect(leftovers, `E2E kalıntısı: ${leftovers.join(" | ")}`).toEqual([]);
  });
});
