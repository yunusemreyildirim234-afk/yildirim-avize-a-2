"use client";

/**
 * "İçeriğe atla": sayfadaki ilk odaklanılabilir öğe; yalnızca odaklanınca görünür, ana içeriğe (main) götürür.
 * Sayfalar kendi <main> öğesini çizdiği için hedef tıklanma anında bulunur (id ve tabindex o an atanır).
 */
const TARGET_ID = "icerik";

export default function SkipLink() {
  const go = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const main = document.querySelector<HTMLElement>("main");
    if (!main) return;
    e.preventDefault();
    if (!main.id) main.id = TARGET_ID;
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    main.focus({ preventScroll: true });
    main.scrollIntoView({ block: "start" });
  };

  return (
    <a
      href={`#${TARGET_ID}`}
      onClick={go}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-zinc-900 focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
    >
      İçeriğe atla
    </a>
  );
}
