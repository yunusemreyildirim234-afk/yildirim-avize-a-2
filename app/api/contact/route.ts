import { NextResponse } from "next/server";
import { sendContactEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, subject, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Lütfen gerekli alanları doldurunuz." }, { status: 400 });
    }

    await sendContactEmail({ name, email, phone, subject, message });

    return NextResponse.json({
      success: true,
      message: "Talebiniz Beyoğlu atölyemize ulaştı. Uzman ekibimiz en kısa sürede dönüş yapacaktır.",
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}