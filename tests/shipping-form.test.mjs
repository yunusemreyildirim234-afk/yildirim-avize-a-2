import test from "node:test";
import assert from "node:assert/strict";
import { shippingFormError } from "../lib/validation.ts";

const ok = { name: "Ayşe Yılmaz", address: "Şişhane Mah. Galip Dede Cad. No:10", stateId: 34, cityId: 425, isPickup: false };

test("geçerli teslimat formu", () => {
  assert.equal(shippingFormError(ok), null);
});

test("ad soyad en az iki kelime ve her biri en az 2 harf", () => {
  for (const name of ["Ayşe", "A B", "Ayşe Y", "  ", "12 34"]) {
    assert.equal(shippingFormError({ ...ok, name })?.field, "name", name);
  }
});

test("il ve ilçe seçilmeden sipariş olmaz", () => {
  assert.equal(shippingFormError({ ...ok, stateId: undefined })?.field, "state");
  assert.equal(shippingFormError({ ...ok, cityId: 0 })?.field, "city");
  assert.equal(shippingFormError({ ...ok, cityId: null })?.field, "city");
  assert.equal(shippingFormError({ ...ok, cityId: "425" })?.field, "city");
});

test("adres en az 10 karakter ve en az bir harf içermeli", () => {
  for (const address of ["kısa adr", "1234567890 11", "          ", ""]) {
    assert.equal(shippingFormError({ ...ok, address })?.field, "address", address);
  }
});

test("mağazadan teslimde adres ve ilçe aranmaz ama ad aranır", () => {
  const pickup = { ...ok, address: "", stateId: undefined, cityId: undefined, isPickup: true };
  assert.equal(shippingFormError(pickup), null);
  assert.equal(shippingFormError({ ...pickup, name: "Ayşe" })?.field, "name");
});
