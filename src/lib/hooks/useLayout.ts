"use client";

import { useCallback, useRef, useState } from "react";
import type { GraphNode, GraphEdge } from "../types";
import { calculateLayout } from "../workers/layout-worker";

interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  sizes: Map<string, { width: number; height: number }>;
}

interface UseLayoutResult {
  calculatePositions: (
    nodes: GraphNode[],
    edges: GraphEdge[]
  ) => Promise<LayoutResult>;
  isCalculating: boolean;
  error: string | null;
}

const EMPTY_RESULT: LayoutResult = { positions: new Map(), sizes: new Map() };

/**
 * Layout orchestration runs here (cheap); the ELK solver runs in ELK's own
 * worker (see layout-worker.ts). Each request carries an incrementing token;
 * a slow stale calculation resolves empty and is dropped by the caller's
 * `positions.size > 0` guard, so it can never overwrite a newer layout.
 */
export function useLayout(): UseLayoutResult {
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const calculatePositions = useCallback(
    async (nodes: GraphNode[], edges: GraphEdge[]): Promise<LayoutResult> => {
      setIsCalculating(true);
      setError(null);
      const requestId = ++requestIdRef.current;

      try {
        const result = await calculateLayout(nodes, edges);
        if (requestId !== requestIdRef.current) {
          return EMPTY_RESULT;
        }
        setIsCalculating(false);
        return result;
      } catch (e) {
        if (requestId !== requestIdRef.current) {
          return EMPTY_RESULT;
        }
        setIsCalculating(false);
        setError(e instanceof Error ? e.message : "Layout calculation failed");
        return EMPTY_RESULT;
      }
    },
    []
  );

  return {
    calculatePositions,
    isCalculating,
    error,
  };
}
