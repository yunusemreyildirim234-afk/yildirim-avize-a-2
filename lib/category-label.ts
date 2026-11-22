// Kategori adı zaten "Avizeler"/"Avize"/"Modelleri" ile bitiyorsa kırıntıya ikinci "Avizeler", rozete "Serisi" eklenmez. Saf.

const GENERIC_END = /(^|\s)(avizeler|avize|modelleri)$/iu;

export const endsGeneric = (name: string) => GENERIC_END.test(name.trim());

export const crumbCategoryName = (name: string) => (endsGeneric(name) ? name.trim() : `${name.trim()} Avizeler`);

/** Rozet metni; seri olmayan (genel) kategori adında null: rozet yerine yalnız kategori adı gösterilir. */
export const seriesBadge = (name: string) => (endsGeneric(name) ? null : `${name.trim()} Serisi`);
