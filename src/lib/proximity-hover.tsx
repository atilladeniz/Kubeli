"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LazyMotion, domAnimation, m } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Proximity hover — a single highlight layer that glides between items as the
 * cursor moves, instead of each item toggling its own background. Items report
 * their bounds on pointer-enter; the highlight springs to the hovered item's
 * rectangle and fades out when the pointer leaves the group.
 *
 * Usage:
 *   <ProximityHoverGroup>            // wraps the scrollable menu/list
 *     <ProximityHoverItem asChild>   // one per row
 *       <MenuItem />
 *     </ProximityHoverItem>
 *   </ProximityHoverGroup>
 *
 * The group must be `position: relative` (applied here). The highlight sits at
 * -z-0 behind item content, so items should give their own content a higher
 * stacking context or simply omit a background of their own.
 */

type Rect = { top: number; left: number; width: number; height: number };

interface Ctx {
  onEnter: (el: HTMLElement) => void;
  onLeave: () => void;
}

const ProximityContext = createContext<Ctx | null>(null);

export function ProximityHoverGroup({
  children,
  className,
  radius = "0.375rem",
  ...props
}: {
  children: ReactNode;
  className?: string;
  radius?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);

  const onEnter = useCallback((el: HTMLElement) => {
    const group = groupRef.current;
    if (!group) return;
    const g = group.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setRect({
      top: r.top - g.top + group.scrollTop,
      left: r.left - g.left + group.scrollLeft,
      width: r.width,
      height: r.height,
    });
    setVisible(true);
  }, []);

  const onLeave = useCallback(() => setVisible(false), []);

  return (
    <ProximityContext.Provider value={{ onEnter, onLeave }}>
      <div
        ref={groupRef}
        className={cn("relative", className)}
        onPointerLeave={onLeave}
        {...props}
      >
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
              // spring.fast — quick in, quicker out (the "proximity" feel)
              transition={{ type: "spring", stiffness: 700, damping: 42, mass: 0.5 }}
            />
          )}
        </LazyMotion>
        {children}
      </div>
    </ProximityContext.Provider>
  );
}

/**
 * Marks an element as a proximity target. Reports its bounds on pointer-enter.
 * Renders a plain wrapper span by default; the child is responsible for layout.
 * Items inside a group should NOT set their own hover background — the gliding
 * highlight replaces it. Keep focus/selected states (keyboard nav) as-is.
 */
export function ProximityHoverItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(ProximityContext);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={cn("relative z-10", className)}
      onPointerEnter={() => ref.current && ctx?.onEnter(ref.current)}
    >
      {children}
    </div>
  );
}

/** True when a ProximityHoverGroup is an ancestor (items can opt out of CSS hover). */
export function useInProximityGroup(): boolean {
  return useContext(ProximityContext) !== null;
}
