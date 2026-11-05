import { test } from "../fixtures";

// Ana sayfa HTML ve RSC yükü ölçümü (yalnızca MEASURE tanımlıysa çalışır; sonuç konsola yazılır)
test("ana sayfa boyut ölçümü (isteğe bağlı)", async ({ request }, info) => {
  test.skip(!process.env.MEASURE || info.project.name !== "desktop", "MEASURE tanımlı değil");
  const html = await request.get("/");
  const body = await html.body();
  const text = body.toString("utf8");
  const rsc = await request.get("/", { headers: { RSC: "1" } });
  const rscBody = await rsc.body();
  const links = new Set([...text.matchAll(/href="(\/urun\/[^"]+)"/g)].map((m) => m[1]));
  console.log(`[OLCUM] html=${body.length}B (${(body.length / 1024).toFixed(0)} KB) rsc=${rscBody.length}B (${(rscBody.length / 1024).toFixed(0)} KB) urunLinki=${links.size} kart=${(text.match(/<article/g) ?? []).length}`);
});
