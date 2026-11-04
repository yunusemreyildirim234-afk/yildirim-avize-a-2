import test from "node:test";
import assert from "node:assert/strict";
import { coverImageOf, generalImagesOf, imageListOf, galleryOf, isCompleteOrder } from "../lib/variation-input.ts";

const red = { stock: 3, images: ["/red1.jpg", "/red2.jpg"] };
const blue = { stock: 5, images: ["/blue1.jpg"] };

test("kapak: genel fotoğrafların ilki (renk fotoğrafı olsa da)", () => {
  assert.equal(coverImageOf({ imageUrl: "/g1.jpg", images: ["/g1.jpg", "/g2.jpg"], variations: [red, blue] }), "/g1.jpg");
});

test("kapak: genel yoksa ilk rengin ilk fotoğrafı (ilk rengin fotoğrafı yoksa sıradaki)", () => {
  assert.equal(coverImageOf({ imageUrl: null, images: [], variations: [red, blue] }), "/red1.jpg");
  assert.equal(coverImageOf({ imageUrl: null, images: [], variations: [{ stock: 1, images: [] }, blue] }), "/blue1.jpg");
  assert.equal(coverImageOf({ imageUrl: null, variations: [] }), null);
  assert.equal(coverImageOf({ imageUrl: null, images: [], variations: [{ stock: 1 }] }), null);
});

test("renksiz/eski kayıt: yalnız imageUrl varsa o kapaktır; images boşsa imageUrl geçerli", () => {
  assert.equal(coverImageOf({ imageUrl: "/old.jpg", variations: [] }), "/old.jpg");
  assert.deepEqual(generalImagesOf({ imageUrl: "/old.jpg", images: [] }), ["/old.jpg"]);
  assert.deepEqual(generalImagesOf({ imageUrl: "/a.jpg", images: ["/a.jpg", "/b.jpg", "/a.jpg"] }), ["/a.jpg", "/b.jpg"]);
});

test("kapak değişmezliği: genel alana foto eklemek rengi, renk fotoğrafı silmek genel kapağı bozmaz", () => {
  // senaryo: 2 renk x 1 foto, genel boş → kapak ilk rengin fotoğrafı
  const colors = [{ stock: 2, images: ["/c1.jpg"] }, { stock: 2, images: ["/c2.jpg"] }];
  assert.equal(coverImageOf({ imageUrl: null, images: [], variations: colors }), "/c1.jpg");
  // genel alana foto yüklendi → kapak genel olur, renk fotoğrafları AYNEN kalır
  const after = { imageUrl: "/g.jpg", images: ["/g.jpg"], variations: colors };
  assert.equal(coverImageOf(after), "/g.jpg");
  assert.deepEqual(after.variations.map((v) => v.images), [["/c1.jpg"], ["/c2.jpg"]]);
  // ilk rengin fotoğrafı silindi → kapak hâlâ genel
  assert.equal(coverImageOf({ ...after, variations: [{ stock: 2, images: [] }, colors[1]] }), "/g.jpg");
  // genel de yokken ilk rengin fotoğrafı silinirse kapak sıradaki rengin fotoğrafına geçer (silinen görsel asla dönmez)
  assert.equal(coverImageOf({ imageUrl: null, images: [], variations: [{ stock: 2, images: [] }, colors[1]] }), "/c2.jpg");
  // genel kapak silinirse (images boşaldı) ilk rengin fotoğrafı
  assert.equal(coverImageOf({ imageUrl: null, images: [], variations: colors }), "/c1.jpg");
});

test("galeri: renk seçilmeden genel fotoğraflar; renk seçilince rengin fotoğrafları; rengin fotoğrafı yoksa genel", () => {
  const p = { imageUrl: "/g1.jpg", images: ["/g1.jpg", "/g2.jpg"], variations: [red, blue, { stock: 1, images: [] }] };
  assert.deepEqual(galleryOf(p, red, false), ["/g1.jpg", "/g2.jpg"]); // varsayılan seçili renk olsa bile genel ile açılır
  assert.deepEqual(galleryOf(p, red, true), ["/red1.jpg", "/red2.jpg"]);
  assert.deepEqual(galleryOf(p, p.variations[2], true), ["/g1.jpg", "/g2.jpg"]);
  assert.deepEqual(galleryOf({ imageUrl: null, images: [], variations: [red, blue] }, null, false), ["/red1.jpg", "/red2.jpg"]);
  assert.deepEqual(galleryOf({ imageUrl: null, images: [], variations: [] }, null, false), []);
});

test("feed/JSON-LD listesi: kapak önde, tekil", () => {
  const p = { imageUrl: "/g1.jpg", images: ["/g1.jpg", "/g2.jpg"], variations: [red, blue] };
  assert.deepEqual(imageListOf(p), ["/g1.jpg", "/g2.jpg", "/red1.jpg", "/red2.jpg", "/blue1.jpg"]);
  assert.equal(imageListOf(p)[0], coverImageOf(p));
});

test("renk sırası isteği: tüm renkler bir kez; eksik/fazla/yinelenen/yabancı kimlik reddedilir", () => {
  const ids = ["a", "b", "c"];
  assert.equal(isCompleteOrder(["c", "a", "b"], ids), true);
  assert.equal(isCompleteOrder(["a", "b"], ids), false);
  assert.equal(isCompleteOrder(["a", "b", "b"], ids), false);
  assert.equal(isCompleteOrder(["a", "b", "x"], ids), false);
  assert.equal(isCompleteOrder("abc", ids), false);
  assert.equal(isCompleteOrder([1, 2, 3], ids), false);
});
