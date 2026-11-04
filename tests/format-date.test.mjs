import test from "node:test";
import assert from "node:assert/strict";
import { formatIstanbulDateTime, istanbulDateTimeParts } from "../lib/format-date.ts";

test("sipariş saati her zaman İstanbul (UTC+3) — kış ve yaz", () => {
  assert.equal(formatIstanbulDateTime("2026-11-04T17:31:00Z"), "04.11.2026 20:31");
  assert.equal(formatIstanbulDateTime("2026-01-15T00:05:00Z"), "15.01.2026 03:05"); // kış
  assert.equal(formatIstanbulDateTime("2026-07-15T00:05:00Z"), "15.07.2026 03:05"); // yaz: Türkiye'de sabit +03, yaz saati yok
  assert.equal(formatIstanbulDateTime("2026-12-31T21:30:00Z"), "01.01.2027 00:30"); // gün/yıl sınırı
  assert.equal(formatIstanbulDateTime(new Date("2026-06-01T20:59:00Z")), "01.06.2026 23:59");
});

test("saat 24'lü biçim (00:xx), geçersiz tarih güvenli", () => {
  assert.equal(istanbulDateTimeParts("2026-11-04T21:00:00Z")?.time, "00:00");
  assert.equal(istanbulDateTimeParts("gecersiz"), null);
  assert.equal(formatIstanbulDateTime("gecersiz"), "—");
});
