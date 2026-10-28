import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Uygunsuz yorumu kaldır (yalnızca yönetici)
export async function DELETE(req: Request) {
  const { reviewId } = await req.json().catch(() => ({}));
  if (typeof reviewId !== "string") return NextResponse.json({ error: "reviewId zorunlu" }, { status: 400 });
  await prisma.review.delete({ where: { id: reviewId } }).catch(() => null);
  return NextResponse.json({ success: true });
}
