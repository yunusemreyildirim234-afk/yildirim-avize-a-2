"use client";

/**
 * "İçeriğe atla": sayfadaki ilk odaklanılabilir öğe; yalnızca odaklanınca görünür, ana içeriğe (main) götürür.
 * Hedef, app/layout.tsx'in sayfa içeriğini saran #icerik kutusudur; sunucu çıktısında hazır ve odaklanılabilirdir.
 */
const TARGET_ID = "icerik";

export default function SkipLink() {
  const go = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(TARGET_ID);
    if (!target) return;
    e.preventDefault();
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
  };

  return (
    <a
      href={`#${TARGET_ID}`}
      onClick={go}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-ink focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-canvas focus:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-ink"
    >
      İçeriğe atla
    </a>
  );
}
