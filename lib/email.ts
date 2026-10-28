interface EmailOrderData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  shippingType: string;
  kargonomiShipmentId?: number | null;
  shippingProviderName?: string | null;
  shippingTrackingCode?: string | null;
  shippingBarcode?: string | null;
  items: Array<{ title: string; variationName: string; quantity: number; price: number }>;
}

export async function sendOrderNotificationEmails(data: EmailOrderData) {
  const apiKey = process.env.RESEND_API_KEY;

  const isBeyoglu = data.shippingType === "BEYOGLU_MAGAZA_TESLIM";
  const shippingText = isBeyoglu
    ? "📍 Beyoğlu Şişhane Mağazamızdan Teslim Alınacak"
    : "📦 Sigortalı Üst Düzey Korumalı Koli ile Kapınıza Teslim Edilecek";

  const kargonomiBlock =
    !isBeyoglu && (data.kargonomiShipmentId || data.shippingTrackingCode || data.shippingBarcode)
      ? `
      <div style="background-color: #fffbeb; padding: 16px; border-radius: 12px; border: 1px solid #fde68a; margin: 20px 0;">
        <div style="font-size: 12px; font-weight: bold; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
          🚚 Kargonomi Lojistik Kaydı
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          ${
            data.kargonomiShipmentId
              ? `<tr><td style="padding: 4px 0; color: #78350f;">Kargonomi Gönderi No:</td><td style="padding: 4px 0; text-align: right; font-family: monospace; font-weight: bold; color: #171717;">#${data.kargonomiShipmentId}</td></tr>`
              : ""
          }
          ${
            data.shippingProviderName
              ? `<tr><td style="padding: 4px 0; color: #78350f;">Kargo Firması:</td><td style="padding: 4px 0; text-align: right; font-weight: bold; color: #171717;">${data.shippingProviderName}</td></tr>`
              : ""
          }
          ${
            data.shippingTrackingCode
              ? `<tr><td style="padding: 4px 0; color: #78350f;">Kargo Takip Kodu:</td><td style="padding: 4px 0; text-align: right; font-family: monospace; font-weight: bold; color: #059669;">${data.shippingTrackingCode}</td></tr>`
              : ""
          }
          ${
            data.shippingBarcode
              ? `<tr><td style="padding: 4px 0; color: #78350f;">Paket Barkodu:</td><td style="padding: 4px 0; text-align: right; font-family: monospace; color: #171717;">${data.shippingBarcode}</td></tr>`
              : ""
          }
        </table>
      </div>
      `
      : "";

  // Müşteriye Gidecek Lüks HTML Fatura Şablonu
  const customerHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #fafafa; border: 1px solid #e5e5e5; border-radius: 16px;">
      <h1 style="color: #171717; font-size: 26px; text-align: center; margin-bottom: 4px; letter-spacing: 1px;">YILDIRIM AVİZE</h1>
      <p style="text-align: center; color: #d97706; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-top: 0; font-weight: bold;">Beyoğlu Şişhane Mirası</p>
      
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 25px 0;" />
      
      <div style="text-align: center; margin-bottom: 25px;">
        <span style="display: inline-block; background-color: #ecfdf5; color: #059669; font-size: 13px; font-weight: bold; padding: 6px 16px; border-radius: 20px; border: 1px solid #a7f3d0;">
          ✓ Siparişiniz Başarıyla Alındı
        </span>
      </div>

      <h2 style="color: #171717; font-size: 18px; margin-top: 0;">Sayın ${data.customerName},</h2>
      <p style="color: #525252; font-size: 14px; line-height: 1.6;">
        Yıldırım Avize'yi tercih ettiğiniz için teşekkür ederiz. Seçtiğiniz avizeler atölyemizde ustalarımız tarafından son kalite kontrolleri ve ışık testleri yapılmak üzere sıraya alınmıştır.
      </p>

      <div style="background-color: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #e5e5e5; margin: 25px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #737373;">Sipariş Kodu:</td>
            <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: bold; color: #171717;">${data.orderId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #737373;">Teslimat Türü:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #171717;">${shippingText}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0 6px 0; border-top: 1px solid #f5f5f5; font-size: 15px; font-weight: bold; color: #171717;">Ödenen Toplam Tutar:</td>
            <td style="padding: 12px 0 6px 0; border-top: 1px solid #f5f5f5; text-align: right; font-size: 18px; font-weight: bold; color: #d97706;">${data.totalAmount.toLocaleString("tr-TR")} ₺</td>
          </tr>
        </table>
      </div>

      ${kargonomiBlock}

      <p style="color: #737373; font-size: 12px; line-height: 1.5; text-align: center;">
        Avizeniz hazırlandığında veya kargoya verildiğinde tarafınıza tekrar bilgilendirme yapılacaktır.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 25px 0;" />

      <p style="font-size: 11px; color: #a3a3a3; text-align: center; margin: 0;">
        Tevfikiye Han, İskender Cad, Nazlı Hanım Sk. No:6 D:11, Şişhane / Beyoğlu, İstanbul | Tel: 0545 812 69 90
      </p>
    </div>
  `;

  if (apiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Yıldırım Avize <onboarding@resend.dev>",
          to: [data.customerEmail],
          subject: `✓ Siparişiniz Alındı - #${data.orderId.slice(0, 8)}`,
          html: customerHtml,
        }),
      });

      if (!response.ok) {
        console.error("Resend API uyarısı:", await response.json());
      }
    } catch (err) {
      console.error("Resend bağlantı hatası:", err);
    }
  }
}
export async function sendContactEmail(data: {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.KARGONOMI_SENDER_EMAIL;
  if (!apiKey || !to) return false;

  const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Yıldırım Avize <onboarding@resend.dev>",
        to: [to],
        reply_to: data.email,
        subject: `İletişim Formu: ${data.subject || "Genel"} - ${data.name}`,
        html: `<p><strong>${esc(data.name)}</strong> (${esc(data.email)}${data.phone ? `, ${esc(data.phone)}` : ""})</p><p>${esc(data.message).replace(/\n/g, "<br />")}</p>`,
      }),
    });
    return response.ok;
  } catch (err) {
    console.error("Resend bağlantı hatası:", err);
    return false;
  }
}
