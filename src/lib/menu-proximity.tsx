"use client";

import { useEffect, useRef, useState } from "react";
import { LazyMotion, domAnimation, m } from "motion/react";

/**
 * Menu proximity highlight — a single gliding background for Radix-style menus
 * (Dropdown, Select, ContextMenu, Menubar) where items are direct descendants
 * and must NOT be wrapped (Radix keyboard nav depends on the DOM shape).
 *
 * Drop `<MenuProximityHighlight itemSelector="..." />` as the FIRST child of a
 * `position: relative` content element. It listens for pointer movement on its
 * parent, finds the item under the cursor via `itemSelector`, and springs a
 * highlight to that item's rectangle — fading out when the pointer leaves.
 *
 * Items keep their focus/selected states for keyboard nav; they just drop
 * their own `:hover` background so the gliding layer is the only hover cue.
 */

type Rect = { top: number; left: number; width: number; height: number };

export function MenuProximityHighlight({
  itemSelector,
  radius = "0.375rem",
}: {
  itemSelector: string;
  radius?: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const anchor = anchorRef.current;
    const parent = anchor?.parentElement;
    if (!parent) return;

    const moveTo = (target: HTMLElement) => {
      const p = parent.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      setRect({
        top: r.top - p.top + parent.scrollTop,
        left: r.left - p.left + parent.scrollLeft,
        width: r.width,
        height: r.height,
      });
      setVisible(true);
    };

    const onMove = (e: PointerEvent) => {
      const target = (e.target as HTMLElement | null)?.closest(itemSelector) as
        | HTMLElement
        | null;
      if (!target || target.hasAttribute("data-disabled")) {
        setVisible(false);
        return;
      }
      moveTo(target);
    };
    const leave = () => setVisible(false);

    // Keyboard navigation: Radix marks the active item with data-highlighted.
    // Follow it so the glide is the single hover+focus cue.
    const observer = new MutationObserver(() => {
      const active = parent.querySelector<HTMLElement>(
        `${itemSelector}[data-highlighted]`
      );
      if (active && !active.hasAttribute("data-disabled")) moveTo(active);
    });
    observer.observe(parent, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-highlighted"],
    });

    parent.addEventListener("pointermove", onMove);
    parent.addEventListener("pointerleave", leave);
    return () => {
      observer.disconnect();
      parent.removeEventListener("pointermove", onMove);
      parent.removeEventListener("pointerleave", leave);
    };
  }, [itemSelector]);

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden />
      <LazyMotion features={domAnimation}>
        {rect && (
          <m.div
            aria-hidden
            className="pointer-events-none absolute z-0 bg-[var(--surface-hover)]"
            style={{ borderRadius: radius }}
            initial={false}
            animate={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              opacity: visible ? 1 : 0,
            }}
            transition={{ type: "spring", stiffness: 700, damping: 42, mass: 0.5 }}
          />
        )}
      </LazyMotion>
    </>
  );
}
