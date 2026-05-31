import { useEffect, useRef } from "react";

/**
 * Subtle 3D tilt that follows the pointer. Honors prefers-reduced-motion.
 * Pointer coarse devices are skipped (avoids jank on mobile).
 */
export function useTilt<T extends HTMLElement>(opts: { max?: number; scale?: number; glare?: boolean } = {}) {
  const { max = 8, scale = 1.015, glare = true } = opts;
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    el.style.transformStyle = "preserve-3d";
    el.style.transition = "transform 400ms cubic-bezier(0.16, 1, 0.3, 1)";
    el.style.willChange = "transform";

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (0.5 - py) * max;
      const ry = (px - 0.5) * max;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(1100px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${scale})`;
        if (glare) {
          el.style.setProperty("--glare-x", `${(px * 100).toFixed(1)}%`);
          el.style.setProperty("--glare-y", `${(py * 100).toFixed(1)}%`);
          el.style.setProperty("--glare-opacity", "1");
        }
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      el.style.transition = "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)";
      el.style.transform = "perspective(1100px) rotateX(0deg) rotateY(0deg) scale(1)";
      if (glare) el.style.setProperty("--glare-opacity", "0");
    };
    const onEnter = () => {
      el.style.transition = "transform 200ms ease-out";
    };

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [max, scale, glare]);

  return ref;
}