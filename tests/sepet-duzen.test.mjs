import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Sepet düzeni kaynak metin testi (mevcut sepet testleriyle aynı tarz): CRLF çalışma kopyası normalize edilir.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const sepet = read("app/sepet/page.tsx");

test("blok sırası: ürünler < kupon < teslimat yöntemi < Teslimat Bilgileri formu < sipariş notu < ödeme bilgileri < sipariş özeti", () => {
  const at = (s) => {
    const i = sepet.indexOf(s);
    assert.ok(i > 0, s);
    return i;
  };
  const order = [
    at("{/* Ürün Listesi */}"),
    at("{/* KUPON KODU GİRİŞ KUTUSU */}"),
    at("{/* Teslimat Tercihi */}"),
    at('<form id="odeme-formu"'),
    at("{/* SİPARİŞ NOTU */}"),
    at("{/* Ödeme Bilgileri */}"),
    at('id="siparis-ozeti"'),
  ];
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test("adres formu gerçek başlık altında; özet kutusunda adres alanı yok", () => {
  assert.match(sepet, /<h2[^>]*>Teslimat Bilgileri<\/h2>/);
  const summary = sepet.slice(sepet.indexOf('id="siparis-ozeti"'));
  for (const id of ['id="co-name"', 'id="co-email"', 'id="co-phone"', 'id="co-address"', 'id="co-state"', 'id="co-city"']) assert.ok(!summary.includes(id), id);
  assert.match(summary, /<h2[^>]*>\s*Sipariş Özeti\s*<\/h2>/);
});

test("tek form: handleCheckout bir kez bağlı, gönder düğmesi form='odeme-formu' ile bu forma bağlı", () => {
  assert.equal((sepet.match(/onSubmit=\{handleCheckout\}/g) ?? []).length, 1);
  assert.equal((sepet.match(/<form id="odeme-formu"/g) ?? []).length, 1);
  const btn = sepet.slice(sepet.indexOf('type="submit"\n                form="odeme-formu"'));
  assert.ok(btn.startsWith('type="submit"'), "gönder düğmesi form özniteliği taşır");
  // Gönderilen alanlar formun içinde kalır
  const form = sepet.slice(sepet.indexOf('<form id="odeme-formu"'), sepet.indexOf("</form>", sepet.indexOf('<form id="odeme-formu"')));
  for (const id of ['id="co-name"', 'id="co-email"', 'id="co-phone"', 'id="co-address"', "name=\"invoiceType\""]) assert.ok(form.includes(id), id);
});

test("iş mantığı kilidi: pasif koşulu ve sipariş gövdesi alanları aynen duruyor", () => {
  assert.ok(sepet.includes("disabled={loading || !fresh || !agreePre || !agreeSales || (priceNotice !== null && !priceAcked)}"));
  assert.ok(sepet.includes('aria-describedby={disabledReason ? "odeme-pasif-neden" : undefined}'));
  assert.ok(sepet.includes('data-testid="odeme-pasif-neden"'));
  assert.ok(sepet.includes("const handleCheckout = async (e: React.FormEvent) => {"));
});

test("sıralama CSS order-* ile değil DOM sırasıyla (odak sırası görsel sıradan kopmaz)", () => {
  assert.ok(!/\b(?:max-lg:|lg:|sm:)?order-\d/.test(sepet));
});

test("satır toplamı priceCart çıktısından okunur (yeni hesap yok); merdiven sepette açıklamasız", () => {
  assert.match(sepet, /item\.quantity > 1 && pricedOf\(item\.variationId\)/);
  assert.ok(sepet.includes("pricedOf(item.variationId)!.lineTotal"));
  assert.ok(sepet.includes('size="sm" hints={false}'));
  assert.ok(!/lineTotal\s*[=:]\s*[^;\n]*\*/.test(sepet), "sepet satır toplamını kendisi çarpmaz");
});

test("PriceLadder: hints varsayılan açık (ürün sayfası/kart değişmez), false iken açıklama yok", () => {
  const src = read("components/PriceLadder.tsx");
  assert.match(src, /hints = true/);
  assert.match(src, /\{hints && <span/);
});

test("kupon ipucu mobilde kesilmez: form mobilde dikey, giriş tam genişlik; ad ve etiket aynı", () => {
  assert.match(sepet, /<form onSubmit=\{handleApplyCoupon\} className="flex flex-col sm:flex-row gap-2">/);
  assert.match(sepet, /aria-label="Kupon kodu"/);
  assert.match(sepet, />\s*Kuponu Uygula\s*</);
});

test("ampul notu mobilde kısa: parantezli kısım max-sm:hidden, 'Ampul Dahil Değildir' kalır", () => {
  assert.match(sepet, /<strong>Ampul Dahil Değildir<\/strong>\s*<span className="max-sm:hidden"> \(Standart E14\/E27/);
});
