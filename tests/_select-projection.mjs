// Yalnız test yardımcısı: Prisma `select`'ini taklit eder. Tam satırdan YALNIZ istenen alanlar döner; `include` kullanılırsa kaydedilir.
// Böylece uç, select'te olmayan bir alana dokunursa undefined görür (davranış bozulur) ve gereksiz alan yanıta/okumaya sızmaz.
export function project(row, spec, seen = { include: false, leaves: new Set() }) {
  if (Array.isArray(row)) return row.map((r) => project(r, spec, seen));
  if (row === null || typeof row !== "object") return row;
  if (spec?.include) seen.include = true;
  if (spec?.include) {
    // include: tüm skaler alanlar + istenen ilişkiler (ilişkiler kendi select/include'una göre daraltılır)
    const base = Object.fromEntries(Object.entries(row).filter(([, v]) => v === null || typeof v !== "object" || v instanceof Date));
    for (const [k, v] of Object.entries(spec.include)) base[k] = v === true ? row[k] : project(row[k], v, seen);
    return base;
  }
  const sel = spec?.select ?? spec;
  const out = {};
  for (const [k, v] of Object.entries(sel ?? {})) {
    if (v === true) { seen.leaves.add(k); out[k] = row[k]; }
    else if (v && typeof v === "object") out[k] = project(row[k], v, seen);
  }
  return out;
}
/** args içinde (iç içe) include anahtarı var mı */
export const hasInclude = (args) => JSON.stringify(args).includes('"include"');
/** args içinde `anahtar: true` biçiminde seçilen tüm alan adları */
export function selectedLeaves(args, acc = new Set()) {
  if (args && typeof args === "object") for (const [k, v] of Object.entries(args)) { if (v === true) acc.add(k); else selectedLeaves(v, acc); }
  return acc;
}
