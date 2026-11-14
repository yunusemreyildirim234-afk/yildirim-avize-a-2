import test from "node:test";
import assert from "node:assert/strict";
import { rateLimit, isLimited, recordFailure, requestIp } from "../lib/rate-limit.ts";

const req = (h = {}) => new Request("http://x.test/api", { headers: h });
const ip = (v) => req({ "x-forwarded-for": v });

test("sınır: max kadar istek geçer, bir sonraki sınırlanır ve retryAfter pencereyi aşmaz", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  for (let i = 0; i < 5; i++) assert.equal(rateLimit(ip("10.0.0.1"), "p-sinir", 5, 600_000).limited, false, `istek ${i + 1}`);
  const r = rateLimit(ip("10.0.0.1"), "p-sinir", 5, 600_000);
  assert.equal(r.limited, true);
  assert.equal(r.retryAfter, 600);
  t.mock.timers.tick(100_500);
  assert.equal(rateLimit(ip("10.0.0.1"), "p-sinir", 5, 600_000).retryAfter, 500); // yukarı yuvarlanır: 499.5 → 500
});

test("pencere sonu: süre dolunca sayaç sıfırlanır, tekrar max kadar istek geçer", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 2_000_000 });
  for (let i = 0; i < 6; i++) rateLimit(ip("10.0.0.2"), "p-pencere", 5, 60_000);
  assert.equal(rateLimit(ip("10.0.0.2"), "p-pencere", 5, 60_000).limited, true);
  t.mock.timers.tick(59_999);
  assert.equal(rateLimit(ip("10.0.0.2"), "p-pencere", 5, 60_000).limited, true); // pencere bitmedi
  t.mock.timers.tick(1);
  for (let i = 0; i < 5; i++) assert.equal(rateLimit(ip("10.0.0.2"), "p-pencere", 5, 60_000).limited, false, `yeni pencere ${i + 1}`);
  assert.equal(rateLimit(ip("10.0.0.2"), "p-pencere", 5, 60_000).limited, true);
});

test("farklı IP ve farklı ad ayrı sayaçtır", () => {
  for (let i = 0; i < 4; i++) rateLimit(ip("10.0.0.3"), "p-ayri", 3, 60_000);
  assert.equal(rateLimit(ip("10.0.0.3"), "p-ayri", 3, 60_000).limited, true);
  assert.equal(rateLimit(ip("10.0.0.4"), "p-ayri", 3, 60_000).limited, false);
  assert.equal(rateLimit(ip("10.0.0.3"), "p-baska-ad", 3, 60_000).limited, false);
});

test("başlık: IP, x-forwarded-for'un ilk girdisidir; sondaki zincir sayaca etki etmez, x-real-ip yedektir, başlıksız istekler ortak kovaya düşer", () => {
  assert.equal(requestIp(ip("1.2.3.4, 9.9.9.9")), "1.2.3.4");
  assert.equal(requestIp(ip(" 1.2.3.4 ,5.6.7.8")), "1.2.3.4");
  assert.equal(requestIp(req({ "x-real-ip": "7.7.7.7" })), "7.7.7.7");
  assert.equal(requestIp(req()), "unknown");
  for (let i = 0; i < 3; i++) rateLimit(ip("1.1.1.9, a"), "p-zincir", 2, 60_000);
  assert.equal(rateLimit(ip("1.1.1.9, b"), "p-zincir", 2, 60_000).limited, true);
});

test("başlık sahteciliği (mevcut davranış): istemci x-forwarded-for'un İLK girdisini değiştirerek sınırı aşabilir; koruma platformun başlığı ezmesine dayanır", () => {
  for (let i = 0; i < 20; i++) assert.equal(rateLimit(ip(`8.8.8.${i}`), "p-sahte", 3, 60_000).limited, false);
});

test("isLimited sayacı artırmaz; yalnız recordFailure sayar; sınıra ulaşınca sınırlar", () => {
  const r = ip("10.0.0.5");
  for (let i = 0; i < 10; i++) assert.equal(isLimited(r, "p-basarisiz", 3).limited, false);
  recordFailure(r, "p-basarisiz", 60_000);
  recordFailure(r, "p-basarisiz", 60_000);
  assert.equal(isLimited(r, "p-basarisiz", 3).limited, false);
  recordFailure(r, "p-basarisiz", 60_000);
  assert.equal(isLimited(r, "p-basarisiz", 3).limited, true);
  assert.equal(isLimited(ip("10.0.0.6"), "p-basarisiz", 3).limited, false);
});

test("recordFailure penceresi: süre dolunca isLimited serbest bırakır", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 3_000_000 });
  const r = ip("10.0.0.7");
  for (let i = 0; i < 3; i++) recordFailure(r, "p-basarisiz-sure", 60_000);
  assert.equal(isLimited(r, "p-basarisiz-sure", 3).limited, true);
  t.mock.timers.tick(60_000);
  assert.equal(isLimited(r, "p-basarisiz-sure", 3).limited, false);
});
