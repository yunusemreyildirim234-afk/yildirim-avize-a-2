import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { withStorefrontRevalidate } from "@/lib/revalidate";
import { adminGuard } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { buildCategoryList, categoryKey, RESERVED_SLUGS } from "@/lib/categories";
import { COLLECTIONS, CATEGORIES } from "@/lib/site";
import { buildUndoToken, snapshotProducts } from "@/lib/admin-undo";
import { resolveCollectionKeys } from "@/lib/collections";
import {
  addRedirect,
  patchCategorySetting,
  planDelete,
  planRename,
  removeCollectionKey,
  removeRedirectsTo,
  renameCollectionKey,
  resolveCategoryRedirects,
  resolveCategorySettings,
  validateDisplayTitle,
} from "@/lib/category-settings";

// Kategori yönetimi (yalnızca yönetici). Gövde: { action: "setting" | "rename" | "delete", key, ... }
//  - setting: SABİT kategorinin görünen adı / menüden gizleme (veritabanı adı ve slug değişmez)
//  - rename:  sabit olmayan kategorinin adı (tüm yazım varyantları tek transaction'da; çakışmada onayla birleşir)
//  - delete:  sabit olmayan kategori silinir; ürünler SİLİNMEZ, kategorisi "" olur (Geri Al belirteci döner)

type Tx = Prisma.TransactionClient;
const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Aktif ürünlerden güncel kategori listesi (vitrinle aynı kural; önbelleksiz, transaction içinde). */
async function liveList(tx: Tx) {
  const rows = await tx.product.groupBy({ by: ["category"], where: { active: true }, _count: { _all: true } });
  return buildCategoryList(rows.map((r) => ({ category: r.category, count: r._count._all })), CATEGORIES);
}

/** Pasif ürünler dahil, anahtarı eşleşen tüm veritabanı yazımları. */
async function spellingsOf(tx: Tx, key: string): Promise<string[]> {
  const rows = await tx.product.groupBy({ by: ["category"] });
  return rows.map((r) => r.category).filter((c) => categoryKey(c) === key);
}

/** homepageConfig'i transaction içinde okuyup değiştirir (diğer anahtarlar korunur). */
async function mutateConfig(tx: Tx, fn: (cfg: Record<string, unknown>) => Record<string, unknown>) {
  const cur = (await tx.siteConfig.findUnique({ where: { id: 1 }, select: { homepageConfig: true } }))?.homepageConfig;
  const next = fn({ ...asObj(cur) });
  await tx.siteConfig.upsert({ where: { id: 1 }, create: { id: 1, homepageConfig: next as object }, update: { homepageConfig: next as object } });
}

const liveSlugSet = (list: { slug: string }[]) => new Set<string>([...CATEGORIES.map((c) => c.slug), ...RESERVED_SLUGS, ...Object.keys(COLLECTIONS), ...list.map((c) => c.slug)]);

async function POSTHandler(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const rl = rateLimit(req, "admin-categories", 40, 10 * 60_000);
  if (rl.limited) return tooMany(rl.retryAfter);

  const body = asObj(await req.json().catch(() => null));
  const key = typeof body.key === "string" ? body.key : "";
  if (!key || key.length > 80) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  // ---- Sabit kategori: görünen ad / gizleme ----
  if (body.action === "setting") {
    if (!CATEGORIES.some((c) => categoryKey(c.dbCategory) === key)) return NextResponse.json({ error: "Yalnızca sabit kategoriler için geçerlidir." }, { status: 400 });
    const patch: { title?: string | null; hidden?: boolean | null } = {};
    if (body.title !== undefined) {
      if (body.title === null) patch.title = null;
      else {
        const v = validateDisplayTitle(body.title);
        if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
        patch.title = v.title;
      }
    }
    if (body.hidden !== undefined) {
      if (typeof body.hidden !== "boolean" && body.hidden !== null) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
      patch.hidden = body.hidden;
    }
    if (patch.title === undefined && patch.hidden === undefined) return NextResponse.json({ error: "Değişiklik yok." }, { status: 400 });
    await prisma.$transaction((tx) =>
      mutateConfig(tx, (cfg) => {
        const settings = patchCategorySetting(resolveCategorySettings(cfg), key, patch);
        if (Object.keys(settings).length) cfg.categorySettings = settings;
        else delete cfg.categorySettings; // boş = varsayılan
        return cfg;
      })
    );
    return NextResponse.json({ success: true });
  }

  // ---- Adı değiştir / birleştir ----
  if (body.action === "rename") {
    const name = typeof body.name === "string" ? body.name : "";
    const result = await prisma.$transaction(async (tx) => {
      const list = await liveList(tx);
      const plan = planRename(list, CATEGORIES, key, name, body.confirmMerge === true);
      if (!plan.ok) return { status: 400, json: { error: plan.error } };
      if (plan.kind === "merge-needed") {
        return { status: 409, json: { needsMerge: true, target: plan.target, error: `"${plan.target.title}" kategorisi zaten var (${plan.target.count} ürün). Bu kategoriyle birleşecek; onaylıyor musunuz?` } };
      }
      const oldSlug = list.find((c) => c.key === plan.fromKey)?.slug ?? "";
      const spellings = await spellingsOf(tx, plan.fromKey);
      const moved = await tx.product.updateMany({ where: { category: { in: spellings } }, data: { category: plan.newName } });
      // Yeni durumda canlı slug: eski adres bu slug'a kalıcı yönlenir; ana sayfa koleksiyon anahtarı aynı işlemde güncellenir
      const after = await liveList(tx);
      const entry = after.find((c) => c.key === plan.toKey);
      await mutateConfig(tx, (cfg) => {
        if (entry && oldSlug && oldSlug !== entry.slug) {
          const redirects = addRedirect(resolveCategoryRedirects(cfg), oldSlug, entry.slug, liveSlugSet(after));
          if (Object.keys(redirects).length) cfg.categoryRedirects = redirects;
          else delete cfg.categoryRedirects;
        }
        if (Array.isArray(cfg.collections)) {
          const keys = renameCollectionKey(resolveCollectionKeys(cfg), plan.fromKey, plan.toKey);
          if (keys.length) cfg.collections = keys;
          else delete cfg.collections;
        }
        return cfg;
      });
      return { status: 200, json: { success: true, merged: plan.kind === "merge", updated: moved.count, newName: plan.newName } };
    });
    return NextResponse.json(result.json, { status: result.status });
  }

  // ---- Sil: ürünler kategorisiz kalır (silinmez) ----
  if (body.action === "delete") {
    const list = await prisma.$transaction((tx) => liveList(tx));
    const plan = planDelete(list, key);
    if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: 400 });
    const oldSlug = list.find((c) => c.key === key)?.slug ?? "";
    const spellings = await prisma.$transaction((tx) => spellingsOf(tx, key));
    const ids = (await prisma.product.findMany({ where: { category: { in: spellings } }, select: { id: true } })).map((p) => p.id);
    const before = await snapshotProducts(ids); // Geri Al: etkilenen ürünlerin eski kategorisi
    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.product.updateMany({ where: { category: { in: spellings } }, data: { category: "" } });
      await mutateConfig(tx, (cfg) => {
        if (Array.isArray(cfg.collections)) {
          const keys = removeCollectionKey(resolveCollectionKeys(cfg), key);
          if (keys.length) cfg.collections = keys;
          else delete cfg.collections; // seçim boşaldıysa varsayılan
        }
        const redirects = removeRedirectsTo(resolveCategoryRedirects(cfg), oldSlug);
        if (Object.keys(redirects).length) cfg.categoryRedirects = redirects;
        else delete cfg.categoryRedirects;
        return cfg;
      });
      return r.count;
    });
    const snapshot = ids.length ? await buildUndoToken(before).catch(() => null) : null;
    return NextResponse.json({ success: true, updated, snapshot });
  }

  return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
}

export const POST = withStorefrontRevalidate(POSTHandler);
