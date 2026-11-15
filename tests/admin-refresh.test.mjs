import test from "node:test";
import assert from "node:assert/strict";
import { createRefreshScheduler } from "../lib/admin-refresh.ts";

// Sahte zaman: gerçek zamanlayıcı yok.
function fake({ hidden = false } = {}) {
  const st = { t: 0, refreshes: 0, timers: new Map(), id: 0, hidden };
  const s = createRefreshScheduler({
    refresh: () => st.refreshes++,
    idleMs: 4000,
    maxMs: 20000,
    now: () => st.t,
    setTimer: (fn, ms) => {
      const id = ++st.id;
      st.timers.set(id, { at: st.t + ms, fn });
      return id;
    },
    clearTimer: (id) => st.timers.delete(id),
    isHidden: () => st.hidden,
  });
  const advance = (ms) => {
    const end = st.t + ms;
    for (;;) {
      const due = [...st.timers.entries()].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      st.t = due[1].at;
      st.timers.delete(due[0]);
      due[1].fn();
    }
    st.t = end;
  };
  return { st, s, advance };
}

test("boştayken hiçbir yenileme olmaz", () => {
  const { st, advance } = fake();
  advance(60000);
  assert.equal(st.refreshes, 0);
});

test("art arda 50 çağrı → sakin kalınca tek yenileme (4 sn sonra)", () => {
  const { st, s, advance } = fake();
  for (let i = 0; i < 50; i++) {
    s.schedule();
    advance(100);
  }
  assert.equal(st.refreshes, 0);
  advance(3899);
  assert.equal(st.refreshes, 0);
  advance(1);
  assert.equal(st.refreshes, 1);
  advance(60000);
  assert.equal(st.refreshes, 1);
});

test("sürekli işlemde en geç 20 sn'de yenilenir", () => {
  const { st, s, advance } = fake();
  for (let i = 0; i < 25; i++) {
    s.schedule();
    advance(1000); // her saniye: 4 sn sakinlik hiç oluşmaz
  }
  assert.equal(st.refreshes, 1);
  assert.ok(st.t >= 20000);
});

test("yenilemeden sonra yeni çağrı yeni seri başlatır", () => {
  const { st, s, advance } = fake();
  s.schedule();
  advance(4000);
  s.schedule();
  advance(4000);
  assert.equal(st.refreshes, 2);
});

test("flush bekleyeni anında yenileyip zamanlayıcıyı iptal eder; bekleyen yoksa yenilemez", () => {
  const { st, s, advance } = fake();
  s.flush();
  assert.equal(st.refreshes, 0);
  s.schedule();
  s.flush();
  assert.equal(st.refreshes, 1);
  advance(30000);
  assert.equal(st.refreshes, 1);
});

test("refreshNow bekleyen olmasa da anında yeniler, bekleyeni iptal eder (tek yenileme)", () => {
  const { st, s, advance } = fake();
  s.schedule();
  s.refreshNow();
  assert.equal(st.refreshes, 1);
  advance(30000);
  assert.equal(st.refreshes, 1);
  s.refreshNow();
  assert.equal(st.refreshes, 2);
});

test("sekme gizliyken ertelenir, görünür olunca yenilenir", () => {
  const { st, s, advance } = fake({ hidden: true });
  s.schedule();
  advance(30000);
  assert.equal(st.refreshes, 0);
  assert.equal(s.pending, true);
  s.onVisible(); // hâlâ gizli
  assert.equal(st.refreshes, 0);
  st.hidden = false;
  s.onVisible();
  assert.equal(st.refreshes, 1);
  assert.equal(s.pending, false);
  s.onVisible();
  assert.equal(st.refreshes, 1);
});
