"use client";

import { useEffect, useRef } from "react";
import { useAIStore } from "@/lib/stores/ai-store";
import { useClusterStore } from "@/lib/stores/cluster-store";

/**
 * Hook that handles auto-sending pending analysis when AI panel opens.
 * Used when user triggers AI analysis from resource context menus.
 */
export function usePendingAnalysis() {
  const isSessionActive = useAIStore((s) => s.isSessionActive);
  const startSession = useAIStore((s) => s.startSession);
  const sendMessage = useAIStore((s) => s.sendMessage);
  const setError = useAIStore((s) => s.setError);
  const pendingAnalysis = useAIStore((s) => s.pendingAnalysis);
  const clearPendingAnalysis = useAIStore((s) => s.clearPendingAnalysis);

  const currentCluster = useClusterStore((s) => s.currentCluster);

  // Guards against a second send when the effect re-runs mid-flight
  // (e.g. isSessionActive flips after startSession).
  const sendingRef = useRef(false);

  useEffect(() => {
    if (!pendingAnalysis || !currentCluster) return;
    if (pendingAnalysis.clusterContext !== currentCluster.context) return;

    const sendPendingAnalysis = async () => {
      if (sendingRef.current) return;
      sendingRef.current = true;

      try {
        if (!isSessionActive) {
          try {
            await startSession(currentCluster.context, pendingAnalysis.namespace);
          } catch {
            return;
          }
        }

        try {
          await sendMessage(pendingAnalysis.message);
          // Clear only after a successful send - a failure keeps the
          // prompt in the store so it isn't lost.
          clearPendingAnalysis();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to send message");
        }
      } finally {
        sendingRef.current = false;
      }
    };

    const timer = setTimeout(sendPendingAnalysis, 100);
    return () => clearTimeout(timer);
  }, [
    pendingAnalysis,
    currentCluster,
    isSessionActive,
    startSession,
    sendMessage,
    setError,
    clearPendingAnalysis,
  ]);
}
