// Gerçek veritabanı yok: her çağrı testin verdiği globalThis.__fakePrisma nesnesine gider.
export const prisma = new Proxy({}, { get: (_, k) => globalThis.__fakePrisma?.[k] });
