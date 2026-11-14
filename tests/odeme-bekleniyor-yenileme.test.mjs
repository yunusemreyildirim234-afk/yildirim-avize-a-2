import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Ödeme bekleniyor otomatik yenilemesi GTM kimliğine bağlı değil", () => {
  const yenile = oku("components/AwaitPaymentRefresh.tsx");
  assert.match(yenile, /router\.refresh\(\)/);
  assert.doesNotMatch(yenile, /GTM_ID|lib\/gtm/);
  assert.match(oku("app/siparis-onay/[id]/page.tsx"), /awaitingPayment && <AwaitPaymentRefresh \/>/);
  assert.doesNotMatch(oku("components/GtmEvent.tsx"), /router\.refresh/);
});
