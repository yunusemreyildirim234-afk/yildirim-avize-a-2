import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sortByNameTr } from "../lib/sort-tr.ts";

test("M13: il listesi Türkçe alfabetik sıralanır (plaka sırası değil); girdi değişmez", () => {
  const plaka = [{ id: 1, name: "Adana" }, { id: 6, name: "Ankara" }, { id: 17, name: "Çanakkale" }, { id: 18, name: "Çankırı" }, { id: 33, name: "Mersin" }, { id: 34, name: "İstanbul" }, { id: 35, name: "İzmir" }, { id: 32, name: "Isparta" }, { id: 46, name: "Kahramanmaraş" }, { id: 63, name: "Şanlıurfa" }, { id: 58, name: "Sivas" }, { id: 52, name: "Ordu" }, { id: 80, name: "Osmaniye" }, { id: 27, name: "Gaziantep" }, { id: 28, name: "Giresun" }];
  const before = plaka.map((p) => p.name);
  assert.deepEqual(sortByNameTr(plaka).map((p) => p.name), ["Adana", "Ankara", "Çanakkale", "Çankırı", "Gaziantep", "Giresun", "Isparta", "İstanbul", "İzmir", "Kahramanmaraş", "Mersin", "Ordu", "Osmaniye", "Sivas", "Şanlıurfa"]);
  assert.deepEqual(plaka.map((p) => p.name), before);
});

test("M13: sepet formu: görünür etiketler alanlara bağlı, teslimat yöntemi gerçek radyo grubu", () => {
  const src = readFileSync(new URL("../app/sepet/page.tsx", import.meta.url), "utf8");
  for (const [id, text] of [["co-name", "Adınız Soyadınız"], ["co-email", "E-posta Adresiniz"], ["co-phone", "Telefon Numaranız"], ["co-address", "Açık Teslimat Adresiniz"]]) {
    assert.match(src, new RegExp(`<label htmlFor="${id}"[^>]*>${text}</label>`), text);
    assert.match(src, new RegExp(`id="${id}"`));
  }
  assert.match(src, /htmlFor="co-state"/);
  assert.match(src, /htmlFor="co-city"/);
  assert.equal((src.match(/type="radio" name="teslimat-yontemi"/g) ?? []).length, 2);
  assert.match(src, /<legend[^>]*>\s*Teslimat Yöntemini Seçin:/);
  assert.ok(!/<div\s+onClick=\{\(\) => setShippingType/.test(src), "tıklanabilir div kalmamalı");
  assert.match(src, /sortedStates\.map\(/);
});
