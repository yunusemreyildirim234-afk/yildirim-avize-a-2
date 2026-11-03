// Trendyol içe aktarma KARAR fonksiyonu (saf: veritabanı/ağ yok). Önizleme ve uygulama AYNI planSync çıktısından beslenir.
// Alan grupları ve modlar: SKIP (dokunma) | KEEP (elle değiştirdiklerimi koru) | OVERWRITE (ezerek).
// "Elle değiştirdim" = şimdiki değer ≠ anlık görüntüdeki (son uygulanan Trendyol) değer. Anlık görüntü yoksa KEEP, şimdikinden farklı her alanı korur.
// Stok (varyasyon) ayrı formüllerle hesaplanır; uygulamada tek atomik SQL ile yazılır (bkz. lib/trendyol-apply.ts).

export type Mode = "SKIP" | "KEEP" | "OVERWRITE";
export type Group = "STOCK" | "PRICE" | "TEXT" | "IMAGES" | "CATEGORY" | "VARIANT_INFO" | "ACTIVE";
export type Settings = Record<Group, Mode>;
export type Decision = "EZİLECEK" | "KORUNACAK" | "AYNI" | "ATLANDI";
export type Val = string | number | boolean | null | string[];
type Rec = Record<string, unknown>;

export const GROUPS: Group[] = ["STOCK", "PRICE", "TEXT", "IMAGES", "CATEGORY", "VARIANT_INFO", "ACTIVE"];

export interface IncomingVariation {
  barcode: string;
  variationValue: string;
  extraPrice: number;
  stock: number; // T: Trendyol'un bildirdiği miktar
  stockCode: string | null;
  salePrice: number;
  listPrice: number | null;
}
export interface IncomingProduct {
  mainId: string;
  title: string;
  description: string | null;
  category: string;
  basePrice: number;
  listPrice: number | null;
  images: string[];
  active: boolean;
  brand: string | null;
  trendyolCategory: string | null;
  trendyolUrl: string | null;
  variations: IncomingVariation[];
}

export interface ExistingVariation {
  id: string;
  barcode: string | null;
  variationValue: string;
  extraPrice: number;
  stock: number;
  stockCode: string | null;
  salePrice: number | null;
  listPrice: number | null;
  syncStock: number | null;
  syncSnapshot: Rec | null;
}
export interface ExistingProduct {
  id: string;
  trendyolMainId: string | null;
  title: string;
  description: string | null;
  category: string;
  basePrice: number;
  listPrice: number | null;
  images: string[];
  active: boolean;
  brand: string | null;
  trendyolCategory: string | null;
  trendyolUrl: string | null;
  syncSnapshot: Rec | null;
  variations: ExistingVariation[];
}

export interface FieldChange { alan: string; grup: Group; simdiki: Val; trendyol: Val; karar: Decision; elleDegisti: boolean }
export interface StockOp { mode: "KEEP" | "OVERWRITE"; t: number; degisir: boolean }
export interface VariationWrite { data: Rec; snapshot: Rec | null; stock: StockOp | null }
export interface VariationPlan { barcode: string; id: string | null; yeni: boolean; fields: FieldChange[]; write: VariationWrite | null; create: { data: Rec; snapshot: Rec; syncStock: number | null } | null }
export interface ProductPlan {
  mainId: string;
  id: string | null;
  title: string;
  yeni: boolean;
  kalkan: boolean; // Trendyol'da artık yok
  fields: FieldChange[];
  variations: VariationPlan[];
  kalkanVaryasyon: number; // Trendyol'da olmayan varyasyon sayısı (silinmez, yalnızca bilgi)
  write: { data: Rec; snapshot: Rec | null } | null;
  create: { data: Rec; snapshot: Rec } | null;
  degerYazar: boolean; // en az bir DEĞER değişir (yalnızca anlık görüntü yazan ürünler her zaman uygulanır)
}
export interface Counters { ezilecek: number; korunacak: number; atlandi: number; yeniUrun: number; yeniVaryasyon: number; pasifeAlinacak: number; degisenUrun: number }
export interface Plan { products: ProductPlan[]; sayac: Counters }

const PRODUCT_FIELDS: [Group, string][] = [
  ["TEXT", "title"], ["TEXT", "description"],
  ["PRICE", "basePrice"], ["PRICE", "listPrice"],
  ["IMAGES", "images"],
  ["CATEGORY", "category"], ["CATEGORY", "brand"], ["CATEGORY", "trendyolCategory"], ["CATEGORY", "trendyolUrl"],
  ["ACTIVE", "active"],
];
const VARIATION_FIELDS: [Group, string][] = [
  ["PRICE", "extraPrice"], ["PRICE", "salePrice"], ["PRICE", "listPrice"],
  ["VARIANT_INFO", "variationValue"], ["VARIANT_INFO", "stockCode"],
];

const norm = (v: unknown): unknown => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Math.round(v * 1e4) / 1e4;
  return v;
};
export const eq = (a: unknown, b: unknown) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
const asVal = (v: unknown): Val => (v === undefined ? null : (v as Val));

/** Tek alan kararı. snapKnown: anlık görüntüde bu alan kayıtlı mı. */
export function decide(mode: Mode, current: unknown, trendyol: unknown, snap: unknown, snapKnown: boolean): { karar: Decision; elleDegisti: boolean } {
  const elleDegisti = snapKnown ? !eq(current, snap) : false;
  if (eq(current, trendyol)) return { karar: "AYNI", elleDegisti };
  if (mode === "SKIP") return { karar: "ATLANDI", elleDegisti };
  if (mode === "OVERWRITE") return { karar: "EZİLECEK", elleDegisti };
  // KEEP: anlık görüntü varsa yalnızca elle değiştirilmiş alan korunur; yoksa şimdikinden farklı her alan korunur.
  const manual = snapKnown ? elleDegisti : true;
  return { karar: manual ? "KORUNACAK" : "EZİLECEK", elleDegisti };
}

/** Stok formülü. KEEP: max(0, T + (stok − COALESCE(syncStock, T))). OVERWRITE: max(0, T − açık rezervasyon). */
export function stockDecision(mode: "KEEP" | "OVERWRITE", stock: number, syncStock: number | null, t: number, reserved: number): { karar: Decision; yeni: number } {
  const yeni = mode === "KEEP" ? Math.max(0, t + (stock - (syncStock ?? t))) : Math.max(0, t - reserved);
  if (yeni !== stock) return { karar: "EZİLECEK", yeni };
  if (stock !== t && mode === "KEEP") return { karar: "KORUNACAK", yeni };
  return { karar: "AYNI", yeni };
}

function diffFields(table: [Group, string][], ayarlar: Settings, cur: Rec, inc: Rec, snap: Rec | null) {
  const fields: FieldChange[] = [];
  const data: Rec = {};
  const nextSnap: Rec = {};
  let snapChanged = false;
  for (const [group, key] of table) {
    const mode = ayarlar[group];
    const known = snap != null && key in snap;
    const d = decide(mode, cur[key], inc[key], snap?.[key], known);
    if (d.karar !== "AYNI") fields.push({ alan: key, grup: group, simdiki: asVal(cur[key]), trendyol: asVal(inc[key]), karar: d.karar, elleDegisti: d.elleDegisti });
    if (d.karar === "EZİLECEK") {
      data[key] = inc[key] ?? null;
      if (key === "images") data.imageUrl = (inc.images as string[])[0] ?? null;
    }
    if (mode !== "SKIP") {
      nextSnap[key] = inc[key] ?? null;
      if (!(known && eq(snap?.[key], inc[key]))) snapChanged = true;
    }
  }
  return { fields, data, snapshot: snapChanged ? { ...(snap ?? {}), ...nextSnap } : null, nextSnap };
}

const rec = (x: object) => x as unknown as Rec;

/**
 * Plan üretir. mevcut: yalnızca Trendyol anahtarı (trendyolMainId) olan ürünler işlenir; diğerlerine dokunulmaz.
 * rezerve: varyasyon id → açık rezervasyon adedi (stockDeducted=true, AWAITING_PAYMENT, kartlı).
 */
export function planSync(mevcut: ExistingProduct[], gelen: IncomingProduct[], ayarlar: Settings, rezerve: Record<string, number>): Plan {
  const sayac: Counters = { ezilecek: 0, korunacak: 0, atlandi: 0, yeniUrun: 0, yeniVaryasyon: 0, pasifeAlinacak: 0, degisenUrun: 0 };
  const products: ProductPlan[] = [];
  const existing = new Map<string, ExistingProduct>();
  for (const p of mevcut) if (p.trendyolMainId) existing.set(p.trendyolMainId, p);
  const yeniIzni = (["TEXT", "PRICE", "IMAGES", "CATEGORY", "VARIANT_INFO"] as Group[]).some((g) => ayarlar[g] !== "SKIP");
  const count = (fs: FieldChange[]) => {
    for (const f of fs) {
      if (f.karar === "EZİLECEK") sayac.ezilecek++;
      else if (f.karar === "KORUNACAK") sayac.korunacak++;
      else if (f.karar === "ATLANDI") sayac.atlandi++;
    }
  };
  const snapOf = (g: Group[], r: Rec, table: [Group, string][]) => {
    const s: Rec = {};
    for (const [grp, key] of table) if (g.includes(grp) && ayarlar[grp] !== "SKIP") s[key] = r[key] ?? null;
    return s;
  };

  const seen = new Set<string>();
  for (const inc of gelen) {
    seen.add(inc.mainId);
    const ex = existing.get(inc.mainId);

    if (!ex) {
      if (!yeniIzni) continue;
      const incR = rec(inc);
      const data: Rec = {};
      for (const [, key] of PRODUCT_FIELDS) data[key] = incR[key] ?? null;
      data.imageUrl = inc.images[0] ?? null;
      const vars: VariationPlan[] = inc.variations.map((v) => {
        const vR = rec(v);
        const vd: Rec = {};
        for (const [, key] of VARIATION_FIELDS) vd[key] = vR[key] ?? null;
        vd.stock = Math.max(0, v.stock);
        vd.barcode = v.barcode;
        return { barcode: v.barcode, id: null, yeni: true, fields: [], write: null, create: { data: vd, snapshot: snapOf(GROUPS, vR, VARIATION_FIELDS), syncStock: ayarlar.STOCK !== "SKIP" ? Math.max(0, v.stock) : null } };
      });
      sayac.yeniUrun++; sayac.yeniVaryasyon += vars.length; sayac.degisenUrun++;
      products.push({ mainId: inc.mainId, id: null, title: inc.title, yeni: true, kalkan: false, fields: [], variations: vars, kalkanVaryasyon: 0, write: null, create: { data, snapshot: snapOf(GROUPS, incR, PRODUCT_FIELDS) }, degerYazar: true });
      continue;
    }

    const pd = diffFields(PRODUCT_FIELDS, ayarlar, rec(ex), rec(inc), ex.syncSnapshot);
    count(pd.fields);
    if (pd.fields.some((f) => f.alan === "active" && f.karar === "EZİLECEK" && f.trendyol === false)) sayac.pasifeAlinacak++;

    const byBarcode = new Map<string, ExistingVariation>();
    for (const v of ex.variations) if (v.barcode) byBarcode.set(v.barcode, v);
    const vplans: VariationPlan[] = [];
    let valueWrite = Object.keys(pd.data).length > 0;
    for (const iv of inc.variations) {
      const ev = byBarcode.get(iv.barcode);
      if (!ev) {
        if (!yeniIzni) continue;
        const vR = rec(iv);
        const vd: Rec = {};
        for (const [, key] of VARIATION_FIELDS) vd[key] = vR[key] ?? null;
        vd.stock = Math.max(0, iv.stock);
        vd.barcode = iv.barcode;
        vplans.push({ barcode: iv.barcode, id: null, yeni: true, fields: [], write: null, create: { data: vd, snapshot: snapOf(GROUPS, vR, VARIATION_FIELDS), syncStock: ayarlar.STOCK !== "SKIP" ? Math.max(0, iv.stock) : null } });
        sayac.yeniVaryasyon++;
        valueWrite = true;
        continue;
      }
      const vd = diffFields(VARIATION_FIELDS, ayarlar, rec(ev), rec(iv), ev.syncSnapshot);
      const fields = vd.fields;
      let stock: StockOp | null = null;
      const T = Math.max(0, iv.stock);
      const smode = ayarlar.STOCK;
      if (smode !== "SKIP") {
        const sd = stockDecision(smode, ev.stock, ev.syncStock, T, rezerve[ev.id] ?? 0);
        if (sd.karar !== "AYNI") fields.push({ alan: "stock", grup: "STOCK", simdiki: ev.stock, trendyol: T, karar: sd.karar, elleDegisti: ev.syncStock != null && ev.stock !== ev.syncStock });
        if (sd.karar === "EZİLECEK" || ev.syncStock !== T) stock = { mode: smode, t: T, degisir: sd.yeni !== ev.stock };
      } else if (ev.stock !== T) {
        fields.push({ alan: "stock", grup: "STOCK", simdiki: ev.stock, trendyol: T, karar: "ATLANDI", elleDegisti: false });
      }
      count(fields);
      const write = Object.keys(vd.data).length > 0 || vd.snapshot || stock ? { data: vd.data, snapshot: vd.snapshot, stock } : null;
      if (Object.keys(vd.data).length > 0 || stock?.degisir) valueWrite = true;
      vplans.push({ barcode: iv.barcode, id: ev.id, yeni: false, fields, write, create: null });
    }
    const incCodes = new Set(inc.variations.map((v) => v.barcode));
    const kalkanVaryasyon = ex.variations.filter((v) => v.barcode && !incCodes.has(v.barcode)).length;
    const write = Object.keys(pd.data).length > 0 || pd.snapshot ? { data: pd.data, snapshot: pd.snapshot } : null;
    if (valueWrite) sayac.degisenUrun++;
    products.push({ mainId: inc.mainId, id: ex.id, title: ex.title, yeni: false, kalkan: false, fields: pd.fields, variations: vplans, kalkanVaryasyon, write, create: null, degerYazar: valueWrite });
  }

  // Trendyol'dan kalkan ürünler: yalnızca ACTIVE grubu
  for (const [mainId, ex] of existing) {
    if (seen.has(mainId)) continue;
    const d = diffFields([["ACTIVE", "active"]], ayarlar, rec(ex), { active: false }, ex.syncSnapshot);
    count(d.fields);
    const pasif = d.fields.some((f) => f.karar === "EZİLECEK");
    if (pasif) { sayac.pasifeAlinacak++; sayac.degisenUrun++; }
    const write = pasif || d.snapshot ? { data: d.data, snapshot: d.snapshot } : null;
    if (!write && d.fields.length === 0) continue;
    products.push({ mainId, id: ex.id, title: ex.title, yeni: false, kalkan: true, fields: d.fields, variations: [], kalkanVaryasyon: 0, write, create: null, degerYazar: pasif });
  }
  return { products, sayac };
}

/** Uygulanacak ürünler: seçili liste (yoksa tümü). Yalnızca anlık görüntü yazan (değer değiştirmeyen) ürünler her zaman dahildir. */
export function seciliPlan(plan: Plan, secili?: string[]): ProductPlan[] {
  if (!secili) return plan.products;
  const set = new Set(secili);
  return plan.products.filter((p) => set.has(p.mainId) || !p.degerYazar);
}

const short = (v: Val) => {
  if (Array.isArray(v)) return `${v.length} görsel`;
  if (typeof v === "string") return v.length > 100 ? `${v.slice(0, 100)}…` : v;
  return v;
};

/** Önizleme için hafif görünüm: yazma işlemleri çıkarılır, uzun değerler kısaltılır; yalnızca değer değiştiren ürünler listelenir (ilk `limit`). */
export function onizleme(plan: Plan, limit = 200) {
  const listed = plan.products.filter((p) => p.degerYazar);
  const cut = (fs: FieldChange[]) => fs.map((f) => ({ ...f, simdiki: short(f.simdiki), trendyol: short(f.trendyol) }));
  return {
    sayac: plan.sayac,
    toplamUrun: listed.length,
    listelenmeyen: Math.max(0, listed.length - limit), // listede gösterilmeyen ürün sayısı (yalnızca açık onayla uygulanır)
    urunler: listed.slice(0, limit).map((p) => ({
      mainId: p.mainId,
      title: p.title,
      yeni: p.yeni,
      kalkan: p.kalkan,
      yeniVaryasyon: p.variations.filter((v) => v.yeni).length,
      kalkanVaryasyon: p.kalkanVaryasyon,
      fields: cut(p.fields),
      variations: p.variations.filter((v) => v.fields.length > 0).map((v) => ({ barcode: v.barcode, fields: cut(v.fields) })),
    })),
  };
}
