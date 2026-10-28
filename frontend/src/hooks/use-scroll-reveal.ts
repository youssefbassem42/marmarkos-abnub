import { useEffect } from "react";

/**
 * Reveal the sections of the landing page when they scroll into view.
 *
 * The observer is a progressive enhancement: when the browser does not
 * know it, the content is shown straight away. Without the guard the
 * landing page - the first page every visitor sees - crashed with a
 * white screen.
 */
export function useScrollReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".reveal"));

    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
