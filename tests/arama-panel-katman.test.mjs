import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const nav = readFileSync("components/NavSearch.tsx", "utf8");
const navbar = readFileSync("components/Navbar.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

test("masaüstü arama panelleri kategori çubuğunun (z-10) üstünde ve opak", () => {
  const panels = nav.match(/className="absolute right-0 top-full[^"]*"/g) ?? [];
  assert.equal(panels.length, 2, "sonuç ve son aramalar paneli");
  for (const p of panels) {
    assert.match(p, /\bz-30\b/);
    assert.match(p, /\bbg-raised\b/);
  }
});

test("kategori çubuğu okları z-10, başlık z-50 kalır", () => {
  assert.match(navbar, /absolute top-0 bottom-0 z-10/);
  assert.match(navbar, /<header className="[^"]*\bz-50\b/);
});

test("bg-raised açık ve koyu temada opak hex", () => {
  assert.match(css, /--ya-raised:\s*#[0-9a-fA-F]{6};\r?\n/);
  const all = css.match(/--ya-raised:\s*([^;]+);/g) ?? [];
  assert.equal(all.length, 2);
  for (const v of all) assert.match(v, /#[0-9a-fA-F]{6}/);
});
