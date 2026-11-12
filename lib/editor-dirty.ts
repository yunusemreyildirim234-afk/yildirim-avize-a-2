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
