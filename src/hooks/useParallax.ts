import { useEffect, useRef } from "react";

/**
 * Lightweight scroll parallax. Translates the element on Y axis based on
 * its position within the viewport. Honors prefers-reduced-motion.
 */
export function useParallax<T extends HTMLElement>(speed = 0.25) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let ticking = false;

    const update = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 when element is at viewport bottom, 1 when at top
      const progress = 1 - (r.top + r.height / 2) / vh;
      const y = progress * speed * 100;
      el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      raf = requestAnimationFrame(update);
    };

    el.style.willChange = "transform";
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [speed]);

  return ref;
}