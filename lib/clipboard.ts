// Ortak kopyalama yardımcısı (yeni paket yok): önce Pano API'si, olmazsa textarea + execCommand("copy").
// Her ikisi de olmazsa false döner; çağıran kendi son yedeğini (seçim / prompt) gösterir.

export interface CopyEnv {
  writeText?: (text: string) => Promise<void>;
  execCopy?: (text: string) => boolean;
}

/** Gizli textarea + document.execCommand("copy") yedeği (eski iOS / uygulama içi tarayıcılar). */
export function copyWithTextareaFallback(text: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.left = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function defaultEnv(): CopyEnv {
  return {
    writeText: typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function" ? (t) => navigator.clipboard.writeText(t) : undefined,
    execCopy: copyWithTextareaFallback,
  };
}

/** Metni panoya kopyalar; başardıysa true. */
export async function copyText(text: string, env: CopyEnv = defaultEnv()): Promise<boolean> {
  if (env.writeText) {
    try {
      await env.writeText(text);
      return true;
    } catch {
      // izin yok / güvenli bağlam değil: textarea yedeğine geç
    }
  }
  try {
    return env.execCopy ? env.execCopy(text) : false;
  } catch {
    return false;
  }
}
