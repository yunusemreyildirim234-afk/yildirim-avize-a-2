"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Kartlı ödeme onayı bankadan gecikirse (AWAITING_PAYMENT) sayfa birkaç kez sessizce yenilenir. Ölçüm (GTM) ayarından bağımsızdır. */
export default function AwaitPaymentRefresh() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = window.setInterval(() => {
      if (++n > 8) window.clearInterval(t);
      else router.refresh();
    }, 4000);
    return () => window.clearInterval(t);
  }, [router]);
  return null;
}
