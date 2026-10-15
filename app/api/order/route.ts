import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendOrderNotificationEmails } from "@/lib/email";
import {
  createKargonomiShipment,
  KARGONOMI_STATUS_LABELS,
} from "@/lib/kargonomi";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      phone,
      address,
      buyerStateId,
      buyerCityId,
      buyerStateName,
      buyerCityName,
      packageDesi,
      shippingType,
      items,
      totalAmount,
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Sepetiniz boş olamaz" }, { status: 400 });
    }

    // 1. Müşteriyi bul veya oluştur
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: name || "Müşteri",
          email,
          password: "guest_checkout",
          role: "USER",
        },
      });
    }

    // 2. Sepetteki varyasyonların veritabanındaki geçerliliğini kontrol et
    const validItems = [];
    for (const item of items) {
      let variation = await prisma.productVariation.findUnique({
        where: { id: item.variationId },
      });

      if (!variation) {
        const fallback = await prisma.productVariation.findFirst();
        if (!fallback) {
          return NextResponse.json(
            { error: "Veritabanında ürün bulunamadı. Lütfen sepeti tazeleyin." },
            { status: 400 }
          );
        }
        variation = fallback;
      }

      validItems.push({
        variationId: variation.id,
        quantity: item.quantity,
        unitPrice: item.price,
      });
    }

    // Toplam ürün adedine göre tahmini ahşap sandık desi hesabı (her avize ~3 desi)
    const totalQty = items.reduce((acc: number, i: any) => acc + (Number(i.quantity) || 1), 0);
    const calculatedDesi = Number(packageDesi) || Math.max(3, totalQty * 3);

    // 3. Siparişi veritabanına kaydet
    let order = await prisma.order.create({
      data: {
        userId: user.id,
        totalAmount: parseFloat(totalAmount) || 0,
        shippingType,
        status: "PENDING",
        phone: phone || null,
        address: address || null,
        buyerStateId: buyerStateId ? Number(buyerStateId) : 34,
        buyerCityId: buyerCityId ? Number(buyerCityId) : 425,
        buyerStateName: buyerStateName || "İSTANBUL",
        buyerCityName: buyerCityName || "BEYOĞLU",
        packageDesi: calculatedDesi,
        items: {
          create: validItems,
        },
      },
    });

    // 4. Eğer teslimat yöntemi STANDART_KARGO ise Kargonomi API'de otomatik taslak gönderi oluştur
    let kargonomiInfo: any = null;
    if (shippingType === "STANDART_KARGO") {
      try {
        const contentSummary = items
          .map((i: any) => `${i.quantity}x ${i.title || "Avize"} (${i.variationName || ""})`)
          .join(", ")
          .slice(0, 200);

        const createdShipment = await createKargonomiShipment({
          buyer_name: name || user.name,
          buyer_email: email,
          buyer_phone: phone || "5555555555",
          buyer_address: address || "Teslimat Adresi",
          buyer_state_id: buyerStateId ? Number(buyerStateId) : 34,
          buyer_city_id: buyerCityId ? Number(buyerCityId) : 425,
          packages: [
            {
              content: contentSummary || "Yıldırım Avize Ahşap Sandık Kargo",
              barcode: `YA-${order.id.slice(0, 8).toUpperCase()}`,
              desi: calculatedDesi,
            },
          ],
        });

        const shipmentObj =
          createdShipment?.shipment || createdShipment?.data || createdShipment;
        if (shipmentObj?.id) {
          const status = shipmentObj.status || "draft";
          const statusLabel =
            shipmentObj.status_label || KARGONOMI_STATUS_LABELS[status] || "Taslak";
          const barcode =
            shipmentObj.shipping_webservice_barcode ||
            shipmentObj.shipment_packages?.[0]?.barcode ||
            `YA-${order.id.slice(0, 8).toUpperCase()}`;

          order = await prisma.order.update({
            where: { id: order.id },
            data: {
              kargonomiShipmentId: Number(shipmentObj.id),
              kargonomiStatus: status,
              kargonomiStatusLabel: statusLabel,
              shippingBarcode: barcode,
            },
          });

          kargonomiInfo = {
            shipmentId: shipmentObj.id,
            status,
            statusLabel,
            barcode,
          };
        }
      } catch (kargoErr) {
        // Kargonomi bağlantı veya doğrulama uyarısı siparişi engellemez; admin panelinden tek tıkla oluşturulabilir
        console.warn(
          "Kargonomi otomatik taslak gönderi uyarısı (Admin panelinden oluşturulabilir):",
          (kargoErr as Error).message
        );
      }
    }

    // 5. E-posta bildirimini tetikle
    sendOrderNotificationEmails({
      orderId: order.id,
      customerName: name,
      customerEmail: email,
      totalAmount: parseFloat(totalAmount) || 0,
      shippingType,
      kargonomiShipmentId: order.kargonomiShipmentId,
      shippingBarcode: order.shippingBarcode,
      items: items.map((i: any) => ({
        title: i.title || "Avize",
        variationName: i.variationName || "",
        quantity: i.quantity,
        price: i.price,
      })),
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      kargonomi: kargonomiInfo,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}