"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Substrate context — the surface level a component sits ON.
 *
 * Each container reads its own level and re-provides level+offset to
 * descendants, so an overlay opened inside a dialog lands one step lighter
 * than the dialog without any props threaded between them. Because React
 * context crosses portals, this works even when Radix teleports a popover
 * to <body>: the popover still reads the dialog's level.
 */
const SurfaceContext = createContext<number>(1);

export function SurfaceProvider({
  value,
  children,
}: {
  value: number;
  children: ReactNode;
}) {
  return (
    <SurfaceContext.Provider value={value}>{children}</SurfaceContext.Provider>
  );
}

/** The surface level the current subtree sits on (defaults to page = 1). */
export function useSurface(): number {
  return useContext(SurfaceContext);
}
