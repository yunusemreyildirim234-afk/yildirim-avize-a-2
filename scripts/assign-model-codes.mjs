// Model kodu boş olan ürünlere, mevcut en büyük koddan sonra sırayla 1,2,3... atar.
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();
const all = await prisma.product.findMany({ select: { id: true, modelCode: true, createdAt: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
const used = new Set(all.map((p) => p.modelCode).filter(Boolean));
let n = 1;
let assigned = 0;
for (const p of all) {
  if (p.modelCode) continue;
  while (used.has(String(n))) n++;
  await prisma.product.update({ where: { id: p.id }, data: { modelCode: String(n) } });
  used.add(String(n));
  assigned++;
}
console.log(`Toplam ürün: ${all.length}, yeni atanan: ${assigned}`);
await prisma.$disconnect();
