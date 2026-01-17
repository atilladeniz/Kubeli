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

export function useLayout(): UseLayoutResult {
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const calculatePositions = useCallback(
    async (
      nodes: GraphNode[],
      edges: GraphEdge[]
    ): Promise<LayoutResult> => {
      setIsCalculating(true);
      setError(null);
      abortRef.current = false;

      try {
        const result = await calculateLayout(nodes, edges);

        if (abortRef.current) {
          return { positions: new Map(), sizes: new Map() };
        }

        setIsCalculating(false);
        return result;
      } catch (e) {
        const errorMessage =
          e instanceof Error ? e.message : "Layout calculation failed";
        setError(errorMessage);
        setIsCalculating(false);
        return { positions: new Map(), sizes: new Map() };
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
