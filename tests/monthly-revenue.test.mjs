import test from "node:test";
import assert from "node:assert/strict";
import "./_alias.mjs";

const { monthlyRevenue } = await import("../lib/monthly-revenue.ts");
const d = (s) => new Date(s);

test("ay sınırı İstanbul takvimine göre", () => {
  const r = monthlyRevenue(
    [
      { createdAt: d("2026-10-31T21:30:00Z"), totalAmount: 100 },
      { createdAt: d("2026-10-31T20:59:59Z"), totalAmount: 50 },
    ],
    d("2026-11-22T10:00:00Z"),
  );
  assert.equal(r.months.find((m) => m.key === "2026-11").revenue, 100);
  assert.equal(r.months.find((m) => m.key === "2026-10").revenue, 50);
});

test("siparişsiz aylar 0, en yeni üstte, bu ay işaretli", () => {
  const r = monthlyRevenue([{ createdAt: d("2026-08-15T10:00:00Z"), totalAmount: 10 }], d("2026-11-22T10:00:00Z"));
  assert.deepEqual(r.months.map((m) => m.key), ["2026-11", "2026-10", "2026-09", "2026-08"]);
  assert.equal(r.months[1].revenue, 0);
  assert.equal(r.months[1].orderCount, 0);
  assert.equal(r.currentKey, "2026-11");
  assert.equal(r.currentLabel, "Kasım 2026");
});

test("toplam = ay toplamlarının toplamı (kuruş doğruluğu)", () => {
  const rows = [0.1, 0.2, 1234.56, 99.99, 0.07].map((x, i) => ({ createdAt: d(`2026-0${(i % 3) + 1}-10T10:00:00Z`), totalAmount: x }));
  const r = monthlyRevenue(rows, d("2026-03-20T10:00:00Z"));
  const sum = r.months.reduce((n, m) => n + Math.round(m.revenue * 100), 0);
  assert.equal(sum, Math.round(r.total * 100));
  assert.equal(r.total, 1334.92);
});

test("now değişince bu ay değişir; sipariş yoksa yalnız bu ay", () => {
  const o = [{ createdAt: d("2026-10-05T10:00:00Z"), totalAmount: 70 }];
  assert.equal(monthlyRevenue(o, d("2026-10-20T10:00:00Z")).currentRevenue, 70);
  assert.equal(monthlyRevenue(o, d("2026-11-01T10:00:00Z")).currentRevenue, 0);
  const e = monthlyRevenue([], d("2026-11-22T10:00:00Z"));
  assert.equal(e.months.length, 1);
  assert.equal(e.total, 0);
});

test("satırlardan: 31 Mart 21:30 UTC = 1 Nisan İstanbul (ay anahtarı SQL'den gelir) ve sonuç sipariş listesiyle aynı", async () => {
  const { monthlyRevenueFromRows } = await import("../lib/monthly-revenue.ts");
  const now = d("2026-04-15T10:00:00Z");
  const orders = [
    { createdAt: d("2026-03-31T21:30:00Z"), totalAmount: 100.5 },
    { createdAt: d("2026-03-31T20:59:59Z"), totalAmount: 50 },
    { createdAt: d("2026-04-02T10:00:00Z"), totalAmount: 20.25 },
  ];
  const rows = [
    { key: "2026-03", n: 1, kurus: 5000 },
    { key: "2026-04", n: 2, kurus: 12075 },
  ];
  const fromRows = monthlyRevenueFromRows(rows, now);
  assert.deepEqual(fromRows, monthlyRevenue(orders, now));
  assert.equal(fromRows.months.find((m) => m.key === "2026-04").orderCount, 2);
  assert.equal(fromRows.total, 170.75);
});
