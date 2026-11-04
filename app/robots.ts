import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/product-images/"], // daha özel kural: yüklenen ürün görselleri (feed image_link) taranabilsin
      disallow: ["/admin", "/api/", "/sepet", "/giris", "/siparis-onay/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
