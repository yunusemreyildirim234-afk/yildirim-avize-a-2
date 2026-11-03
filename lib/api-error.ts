import { NextResponse } from "next/server";

/** Beklenmeyen hatada ayrıntı yalnızca sunucu logunda kalır; istemciye genel Türkçe mesaj döner. */
export function serverError(tag: string, error: unknown, message = "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.", status = 500) {
  console.error(`[${tag}]`, (error as Error)?.message ?? error);
  return NextResponse.json({ error: message }, { status });
}

/** Boş/bozuk JSON gövdesi için ortak yanıt. */
export const badRequest = () => NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
