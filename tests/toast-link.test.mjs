import test from "node:test";
import assert from "node:assert/strict";
import { toastHref, hrefFromTestId, isInternalLink, resolveLinkAction } from "../lib/toast-link.ts";

test("toastHref ve hrefFromTestId gidiş-dönüş; bağlantısız/dış değerler null", () => {
  assert.equal(toastHref("/sepet").testId, "href:/sepet");
  assert.equal(hrefFromTestId("href:/sepet"), "/sepet");
  assert.equal(hrefFromTestId("href:/admin#siparisler"), "/admin#siparisler");
  assert.equal(hrefFromTestId(null), null);
  assert.equal(hrefFromTestId("baska"), null);
  assert.equal(hrefFromTestId("href:https://kotu.example"), null);
  assert.equal(hrefFromTestId("href://kotu.example"), null);
});

test("isInternalLink yalnızca site içi mutlak yolları kabul eder", () => {
  for (const ok of ["/sepet", "/giris#siparisler", "/kargo-takip?code=ABC", "/urun/1#yorumlar"]) assert.equal(isInternalLink(ok), true, ok);
  for (const bad of ["", null, undefined, "sepet", "//x.com", "http://x.com", "/a b", "/a\\b"]) assert.equal(isInternalLink(bad), false, String(bad));
});

test("resolveLinkAction: zaten o sayfadaysa yönlendirme yok; hash aynı sayfada hash; aksi navigate", () => {
  assert.deepEqual(resolveLinkAction("/sepet", "/sepet"), { kind: "none" });
  assert.deepEqual(resolveLinkAction("/urun/1", "/sepet"), { kind: "navigate", href: "/sepet" });
  assert.deepEqual(resolveLinkAction("/admin", "/admin#siparisler"), { kind: "hash", hash: "siparisler" });
  assert.deepEqual(resolveLinkAction("/giris", "/giris#kuponlar"), { kind: "hash", hash: "kuponlar" });
  assert.deepEqual(resolveLinkAction("/", "/admin#siparisler"), { kind: "navigate", href: "/admin#siparisler" });
  assert.deepEqual(resolveLinkAction("/kargo-takip", "/kargo-takip?code=X"), { kind: "navigate", href: "/kargo-takip?code=X" });
  assert.deepEqual(resolveLinkAction("/", null), { kind: "none" });
  assert.deepEqual(resolveLinkAction("/", "https://dis.com"), { kind: "none" });
});
