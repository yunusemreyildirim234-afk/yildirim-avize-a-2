"use client";

import { toast } from "sonner";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** BankTransferCard'daki Kopyala düğmesiyle aynı davranış: panoya yaz, bildirim göster, olmazsa prompt. */
export default function CopyCodeButton({ text, label = "Kod kopyalandı" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(label);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Kopyalayın:", text);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 inline-flex items-center gap-1 rounded-md bg-ink hover:bg-bronze-ink text-canvas text-[10px] font-semibold px-2 py-1 transition-colors"
    >
      {copied ? <Check aria-hidden="true" className="w-3 h-3" /> : <Copy aria-hidden="true" className="w-3 h-3" />}
      {copied ? "Kopyalandı" : "Kopyala"}
    </button>
  );
}
