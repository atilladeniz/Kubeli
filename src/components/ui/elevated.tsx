"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSurface, SurfaceProvider } from "@/lib/surface-context";
import { surfaceClasses } from "@/lib/surface-classes";

interface ElevatedProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Steps above the current substrate.
   *
   * The component's own surface level becomes `min(substrate + offset, 8)`
   * and is re-provided to descendants via SurfaceProvider, so further
   * nesting walks up the ladder automatically.
   *
   * Conventional offsets:
   *   2 — dropdown / popover / select menu
   *   4 — dialog / modal
   */
  offset: number;
  /**
   * Override for the shadow level. Defaults to the computed surface level.
   *
   * Pass a fixed value when the component should keep a constant shadow
   * weight regardless of how deeply it's nested.
   */
  shadowLevel?: number;
  children?: ReactNode;
}

const Elevated = forwardRef<HTMLDivElement, ElevatedProps>(
  ({ offset, shadowLevel, className, children, ...props }, ref) => {
    const substrate = useSurface();
    const level = Math.min(substrate + offset, 8);
    return (
      <SurfaceProvider value={level}>
        <div
          ref={ref}
          className={cn(surfaceClasses(level, shadowLevel ?? level), className)}
          {...props}
        >
          {children}
        </div>
      </SurfaceProvider>
    );
  }
);
Elevated.displayName = "Elevated";

export { Elevated };
