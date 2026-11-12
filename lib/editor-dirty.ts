// Yönetici ürün düzenleyicisinin saf çekirdeği (React/veritabanı yok; birim test edilir).
// "Taban" (base) = formun açıldığı andaki ya da son başarılı kayıttaki değerler. Canlı prop'tan AYRI tutulur:
// stok kaydı sunucuya prevStock olarak tabanı gönderir; sunucu (lib/stock-edit.ts) yalnızca veritabanı hâlâ o değerdeyse yazar.

export interface InfoForm {
  title: string;
  basePrice: string;
  modelCode: string;
  ebat: string;
  isFeatured: boolean;
  isBestSeller: boolean;
}

export interface VarForm {
  stock: string;
  extraPrice: string;
}

export interface EditorState {
  info: InfoForm;
  images: string[];
  vars: Record<string, VarForm>;
  varImages: Record<string, string[]>;
  order: string[];
}

export interface EditorSource {
  title: string;
  basePrice: number;
  modelCode?: string | null;
  ebat?: string | null;
  imageUrl?: string | null;
  images?: string[];
  isFeatured?: boolean;
  isBestSeller?: boolean;
  variations: { id: string; stock: number; extraPrice: number; images?: string[] }[];
}

/** Sunucudan gelen ürünün form karşılığı (düz, karşılaştırılabilir veri). */
export function editorStateOf(p: EditorSource): EditorState {
  return {
    info: { title: p.title, basePrice: String(p.basePrice), modelCode: p.modelCode ?? "", ebat: p.ebat ?? "", isFeatured: Boolean(p.isFeatured), isBestSeller: Boolean(p.isBestSeller) },
    images: p.images?.length ? [...p.images] : p.imageUrl ? [p.imageUrl] : [],
    vars: Object.fromEntries(p.variations.map((v) => [v.id, { stock: String(v.stock), extraPrice: String(v.extraPrice) }])),
    varImages: Object.fromEntries(p.variations.map((v) => [v.id, [...(v.images ?? [])]])),
    order: p.variations.map((v) => v.id),
  };
}

/** Renk satırı kaydının gövdesi. prevStock her zaman TABANDAN gelir (canlı/yenilenen değerden değil). */
export function stockSaveBody(variationId: string, base: VarForm, form: VarForm) {
  return { variationId, stock: Number(form.stock), prevStock: Number(base.stock), extraPrice: Number(form.extraPrice) };
}

// ---------- Kirli (kaydedilmemiş) parçalar ----------
export interface Dirty {
  info: boolean;
  images: boolean;
  vars: string[];
  varImages: string[];
  order: boolean;
}

const sameList = (a: readonly string[] | undefined, b: readonly string[] | undefined) => a !== undefined && b !== undefined && a.length === b.length && a.every((x, i) => x === b[i]);
const sameInfo = (a: InfoForm, b: InfoForm) => a.title === b.title && a.basePrice === b.basePrice && a.modelCode === b.modelCode && a.ebat === b.ebat && a.isFeatured === b.isFeatured && a.isBestSeller === b.isBestSeller;
const sameVar = (a: VarForm | undefined, b: VarForm | undefined) => a !== undefined && b !== undefined && a.stock === b.stock && a.extraPrice === b.extraPrice;

export function dirtyOf(base: EditorState, form: EditorState): Dirty {
  return {
    info: !sameInfo(base.info, form.info),
    images: !sameList(base.images, form.images),
    vars: form.order.filter((id) => form.vars[id] && !sameVar(base.vars[id], form.vars[id])),
    varImages: form.order.filter((id) => form.varImages[id] && !sameList(base.varImages[id], form.varImages[id])),
    order: !sameList(base.order, form.order),
  };
}

export const isDirty = (d: Dirty) => d.info || d.images || d.vars.length > 0 || d.varImages.length > 0 || d.order;

/** Çubuktaki "Kaydedilmemiş değişiklikler: ..." listesi. */
export function dirtyLabels(d: Dirty): string[] {
  const out: string[] = [];
  if (d.info) out.push("Bilgiler");
  if (d.images) out.push("Genel fotoğraflar");
  if (d.vars.length) out.push(`Renkler (${d.vars.length})`);
  if (d.varImages.length) out.push(`Renk fotoğrafları (${d.varImages.length})`);
  if (d.order) out.push("Renk sırası");
  return out;
}

/** Sunucunun Geri Al belirteci döndürmediği parçalar kirli mi (renk fotoğrafı, renk sırası). */
export const hasNoUndoParts = (d: Dirty) => d.varImages.length > 0 || d.order;

const MAX_STOCK = 99999;
type NameOf = (variationId: string) => string;

/** İstek atmadan önce: yalnızca kirli parçalar denetlenir. Boş dizi = geçerli. */
export function validateDirty(form: EditorState, d: Dirty, nameOf: NameOf): string[] {
  const errors: string[] = [];
  if (d.info) {
    if (!form.info.title.trim()) errors.push("Ürün başlığı boş olamaz.");
    const price = Number(form.info.basePrice);
    if (form.info.basePrice.trim() === "" || !Number.isFinite(price) || price < 0) errors.push("Geçerli bir fiyat giriniz.");
  }
  for (const id of d.vars) {
    const v = form.vars[id];
    if (!/^\d+$/.test(v.stock.trim()) || Number(v.stock) > MAX_STOCK) errors.push(`${nameOf(id)}: stok 0-${MAX_STOCK} arasında tam sayı olmalı.`);
    const extra = Number(v.extraPrice);
    if (v.extraPrice.trim() === "" || !Number.isFinite(extra) || extra < 0) errors.push(`${nameOf(id)}: ek fiyat 0 veya daha büyük olmalı.`);
  }
  return errors;
}

// ---------- Kayıt planı ----------
export interface SaveStep {
  part: "info" | "var" | "varImages" | "order";
  /** Varyasyon kimliği (var / varImages) */
  id?: string;
  /** Satır/hata eşlemesi için anahtar: "info", "var:<id>", "varImages:<id>", "order" */
  key: string;
  label: string;
  method: "PATCH";
  url: string;
  body: Record<string, unknown>;
  /** Sunucu bu adım için Geri Al belirteci döndürür mü */
  undoable: boolean;
}

/**
 * "Tümünü kaydet": yalnızca kirli parçalar, SIRAYLA çağrılacak adımlar (mevcut iki uç; API değişmez).
 * Sıra: bilgiler + genel fotoğraflar, renk stok/ek fiyat satırları, renk fotoğrafları, renk sırası.
 */
export function savePlan(productId: string, base: EditorState, form: EditorState, nameOf: NameOf): SaveStep[] {
  const d = dirtyOf(base, form);
  const steps: SaveStep[] = [];
  if (d.info || d.images) {
    const i = form.info;
    steps.push({
      part: "info",
      key: "info",
      label: d.info && d.images ? "Bilgiler ve genel fotoğraflar" : d.info ? "Bilgiler" : "Genel fotoğraflar",
      method: "PATCH",
      url: "/api/admin/product",
      body: { productId, title: i.title, basePrice: Number(i.basePrice), modelCode: i.modelCode, ebat: i.ebat, images: form.images, isFeatured: i.isFeatured, isBestSeller: i.isBestSeller },
      undoable: true,
    });
  }
  for (const id of d.vars) {
    // Taban yoksa (yeni eklenen renk henüz tabana girmemiş) form değeri tabandır: stok yazılmaz, yalnızca ek fiyat gider
    steps.push({ part: "var", id, key: `var:${id}`, label: `${nameOf(id)} stok/ek fiyat`, method: "PATCH", url: "/api/admin/product", body: stockSaveBody(id, base.vars[id] ?? form.vars[id], form.vars[id]), undoable: true });
  }
  for (const id of d.varImages) {
    steps.push({ part: "varImages", id, key: `varImages:${id}`, label: `${nameOf(id)} fotoğrafları`, method: "PATCH", url: "/api/admin/product/variation", body: { variationId: id, images: form.varImages[id] }, undoable: false });
  }
  if (d.order) steps.push({ part: "order", key: "order", label: "Renk sırası", method: "PATCH", url: "/api/admin/product/variation", body: { productId, order: form.order }, undoable: false });
  return steps;
}

/** Başarılı adımdan sonra taban: yalnızca o parçanın tabanı gönderilen form değerine çekilir (başarısız parçalar kirli kalır). */
export function commitStep(base: EditorState, form: EditorState, step: SaveStep): EditorState {
  if (step.part === "info") return { ...base, info: { ...form.info }, images: [...form.images] };
  if (step.part === "order") return { ...base, order: [...form.order] };
  if (!step.id) return base;
  if (step.part === "var") return { ...base, vars: { ...base.vars, [step.id]: { ...form.vars[step.id] } } };
  return { ...base, varImages: { ...base.varImages, [step.id]: [...form.varImages[step.id]] } };
}

/**
 * Sunucudan yeni ürün verisi geldiğinde (router.refresh): kirli OLMAYAN parçalar sunucu değerini alır,
 * kirli parçalar (form + taban) olduğu gibi korunur. Kirli stok satırının tabanı eski kaldığı için
 * arada stok değiştiyse kayıt sunucuda reddedilir (ezilmez). Silinen renkler düşer, yeni renkler eklenir.
 */
export function reconcile(base: EditorState, form: EditorState, server: EditorState): { base: EditorState; form: EditorState } {
  const d = dirtyOf(base, form);
  const nb: EditorState = { info: base.info, images: base.images, vars: {}, varImages: {}, order: [] };
  const nf: EditorState = { info: form.info, images: form.images, vars: {}, varImages: {}, order: [] };
  if (!d.info) nb.info = nf.info = server.info;
  if (!d.images) nb.images = nf.images = server.images;
  for (const id of server.order) {
    const keepVar = d.vars.includes(id) && base.vars[id] !== undefined;
    nb.vars[id] = keepVar ? base.vars[id] : server.vars[id];
    nf.vars[id] = keepVar ? form.vars[id] : server.vars[id];
    const keepImg = d.varImages.includes(id) && base.varImages[id] !== undefined;
    nb.varImages[id] = keepImg ? base.varImages[id] : server.varImages[id];
    nf.varImages[id] = keepImg ? form.varImages[id] : server.varImages[id];
  }
  if (d.order) {
    const alive = new Set(server.order);
    const merge = (o: string[]) => [...o.filter((id) => alive.has(id)), ...server.order.filter((id) => !o.includes(id))];
    nb.order = merge(base.order);
    nf.order = merge(form.order);
  } else {
    nb.order = server.order;
    nf.order = server.order;
  }
  return { base: nb, form: nf };
}

/** Kayıt sonucu özeti (çubukta gösterilir). */
export function resultSummary(ok: number, failed: { label: string; error: string }[]): string {
  if (failed.length === 0) return `✓ ${ok} kayıt kaydedildi.`;
  const list = failed.map((f) => `${f.label}: ${f.error}`).join(" • ");
  return `${ok} kayıt kaydedildi, ${failed.length} başarısız. ${list}`;
}
