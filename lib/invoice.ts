import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export const INVOICE_PENDING_MSG = "Fatura özelliği için veritabanı güncellemesi bekleniyor";
export const MAX_INVOICE_BYTES = 3 * 1024 * 1024; // Vercel istek gövdesi sınırı 4.5 MB

/** OrderInvoice tablosu henüz oluşturulmamışsa (prisma db push öncesi) Prisma bu hata kodlarını döndürür. */
export function isMissingTable(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) return ["P2021", "P2010", "P2022"].includes(e.code);
  return /OrderInvoice/i.test(String((e as Error)?.message ?? "")) && /does not exist|no such table|relation/i.test(String((e as Error)?.message ?? ""));
}

export interface InvoiceMeta {
  fileName: string;
  size: number;
  uploadedAt: string;
  emailSentAt: string | null;
}

export type InvoiceMetaResult = { state: "ok"; byOrder: Record<string, InvoiceMeta> } | { state: "missing" | "error"; byOrder: Record<string, InvoiceMeta> };

/**
 * Fatura bilgileri (dosya içeriği olmadan). Ana sipariş sorgularından ayrıdır; tablo yoksa veya sorgu hata verirse
 * sayfaların geri kalanı çalışmaya devam eder.
 */
export async function getInvoiceMeta(orderIds: string[]): Promise<InvoiceMetaResult> {
  if (orderIds.length === 0) return { state: "ok", byOrder: {} };
  try {
    const rows = await prisma.orderInvoice.findMany({
      where: { orderId: { in: orderIds } },
      select: { orderId: true, fileName: true, size: true, uploadedAt: true, emailSentAt: true },
    });
    const byOrder: Record<string, InvoiceMeta> = {};
    for (const r of rows) {
      byOrder[r.orderId] = { fileName: r.fileName, size: r.size, uploadedAt: r.uploadedAt.toISOString(), emailSentAt: r.emailSentAt?.toISOString() ?? null };
    }
    return { state: "ok", byOrder };
  } catch (e) {
    if (isMissingTable(e)) return { state: "missing", byOrder: {} };
    console.error("[invoice] fatura bilgileri okunamadı:", (e as Error).message);
    return { state: "error", byOrder: {} };
  }
}

/** Yol ayırıcıları ve kontrol karakterlerini temizler, .pdf uzantısını garanti eder. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\/]/).pop() ?? "";
  const cleaned = base
    .replace(/\.pdf$/i, "")
    .replace(/[^\p{L}\p{N}._ -]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${cleaned || "fatura"}.pdf`;
}

/** Fatura indirme yanıt başlıkları (her zaman indirme, önbelleksiz, nosniff). */
export function invoiceHeaders(fileName: string): HeadersInit {
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="fatura.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
