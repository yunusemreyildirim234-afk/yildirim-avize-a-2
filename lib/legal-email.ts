// Sipariş onay e-postasındaki Ön Bilgilendirme / Mesafeli Satış Sözleşmesi özeti.
// Cümleler lib/legal-texts.ts'ten gelir (sepet formu, sözleşme ve /iptal-iade-cayma ile aynı metin); burada yeniden yazılmaz.
// Montaj notu bilerek özette yoktur.

import { AYIPLI_MAL, CAYMA, LEGAL_UPDATED, ODEME, TESLIMAT_SURESI } from "@/lib/legal-texts";

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

export function buildLegalSummaryHtml(siteUrl: string): string {
  const item = (title: string, text: string) =>
    `<li style="margin: 0 0 8px 0;"><strong style="color: #171717;">${esc(title)}:</strong> ${esc(text)}</li>`;
  const link = (path: string, label: string) => `<a href="${esc(siteUrl)}${path}" style="color: #92400e; font-weight: bold;">${esc(label)}</a>`;
  return `
      <div style="background-color: #ffffff; padding: 16px 20px; border-radius: 12px; border: 1px solid #e5e5e5; margin: 0 0 25px 0; font-size: 12px; line-height: 1.6; color: #525252;">
        <div style="font-size: 12px; font-weight: bold; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Ön Bilgilendirme ve Sözleşme Özeti</div>
        <ul style="margin: 0; padding-left: 18px;">
          ${item("Cayma hakkı", CAYMA.hak)}
          ${item("Cayma hakkının istisnası", CAYMA.istisna)}
          ${item("Ödeme", ODEME)}
          ${item("Teslimat", TESLIMAT_SURESI)}
          ${item("Ayıplı mal", AYIPLI_MAL)}
        </ul>
        <p style="margin: 10px 0 0 0;">Tam metinler: ${link("/mesafeli-satis-sozlesmesi", "Mesafeli Satış Sözleşmesi")} · ${link("/iptal-iade-cayma", "İptal, İade ve Cayma")}</p>
        <p style="margin: 4px 0 0 0; color: #737373;">Metin sürümü: ${esc(LEGAL_UPDATED)}</p>
      </div>`;
}
