import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Tracks the maximum observed width of an element and applies it as min-width,
 * preventing the element from shrinking when content collapses.
 */
export function useWidthRatchet<T extends HTMLElement>(
  ref: RefObject<T | null>,
) {
  const maxWidthRef = useRef(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (width > maxWidthRef.current) {
        maxWidthRef.current = width;
        el.style.minWidth = `${width}px`;
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  const reset = useCallback(() => {
    maxWidthRef.current = 0;
    if (ref.current) ref.current.style.minWidth = "";
  }, [ref]);

  return { reset };
}
