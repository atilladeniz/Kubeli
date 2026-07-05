"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GraphNode, GraphEdge } from "../types";
import type { LayoutResponse } from "../workers/layout-worker";

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

function toResult(response: LayoutResponse): LayoutResult {
  return {
    positions: new Map(Object.entries(response.positions ?? {})),
    sizes: new Map(Object.entries(response.sizes ?? {})),
  };
}

/**
 * ELK layout in a real Web Worker so multi-hundred-node layouts don't block
 * the main thread. Each request carries an incrementing token; responses for
 * anything but the latest request resolve empty and are dropped by the
 * caller's `positions.size > 0` guard, so a slow stale layout can never
 * overwrite a newer one.
 */
export function useLayout(): UseLayoutResult {
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const calculatePositions = useCallback(
    async (nodes: GraphNode[], edges: GraphEdge[]): Promise<LayoutResult> => {
      setIsCalculating(true);
      setError(null);
      const requestId = ++requestIdRef.current;

      const finish = (result: LayoutResult, errorMessage?: string) => {
        // Only the latest request may touch state or deliver data
        if (requestId !== requestIdRef.current) return EMPTY_RESULT;
        setIsCalculating(false);
        if (errorMessage) setError(errorMessage);
        return result;
      };

      // jsdom/SSR have no Worker — fall back to inline calculation (tests).
      // @vite-ignore: never taken in the browser; without it Vite bundles a
      // second full ELK chunk into dist just for this branch.
      if (typeof Worker === "undefined") {
        try {
          const { calculateLayout } = await import(
            /* @vite-ignore */ "../workers/layout-worker"
          );
          return finish(await calculateLayout(nodes, edges));
        } catch (e) {
          return finish(
            EMPTY_RESULT,
            e instanceof Error ? e.message : "Layout calculation failed"
          );
        }
      }

      if (!workerRef.current) {
        workerRef.current = new Worker(
          new URL("../workers/layout-worker.ts", import.meta.url),
          { type: "module" }
        );
      }
      const worker = workerRef.current;

      return new Promise<LayoutResult>((resolve) => {
        const onMessage = (event: MessageEvent<LayoutResponse>) => {
          // A newer request may already be in flight on the same worker;
          // ignore responses that don't match this listener's token.
          if (event.data.id !== requestId) return;
          cleanup();
          if (event.data.type === "complete") {
            resolve(finish(toResult(event.data)));
          } else {
            resolve(finish(EMPTY_RESULT, event.data.error ?? "Layout failed"));
          }
        };
        const onError = (event: ErrorEvent) => {
          cleanup();
          // Broken worker: drop it so the next request spawns a fresh one
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
          resolve(finish(EMPTY_RESULT, event.message || "Layout worker crashed"));
        };
        const cleanup = () => {
          worker.removeEventListener("message", onMessage);
          worker.removeEventListener("error", onError);
        };

        worker.addEventListener("message", onMessage);
        worker.addEventListener("error", onError);
        worker.postMessage({ type: "layout", id: requestId, nodes, edges });
      });
    },
    []
  );

  return {
    calculatePositions,
    isCalculating,
    error,
  };
}
