import { test } from "../fixtures";
test("ana sayfa ve liste HTML boyutu (isteğe bağlı)", async ({ request }, info) => {
  test.skip(!process.env.MEASURE || info.project.name !== "desktop", "MEASURE yok");
  for (const p of ["/", "/kategori/tum"]) {
    const r = await request.get(p);
    const b = await r.body();
    console.log(`[OLCUM] ${p} html=${b.length}B`);
  }
});
