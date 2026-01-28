"use client";

import { useEffect } from "react";
import { useAIStore } from "@/lib/stores/ai-store";
import { useClusterStore } from "@/lib/stores/cluster-store";

/**
 * Hook that handles auto-sending pending analysis when AI panel opens.
 * Used when user triggers AI analysis from resource context menus.
 */
export function usePendingAnalysis() {
  const {
    isSessionActive,
    startSession,
    sendMessage,
    setError,
    pendingAnalysis,
    clearPendingAnalysis,
  } = useAIStore();

  const { currentCluster } = useClusterStore();

  useEffect(() => {
    if (!pendingAnalysis || !currentCluster) return;
    if (pendingAnalysis.clusterContext !== currentCluster.context) return;

    const sendPendingAnalysis = async () => {
      const message = pendingAnalysis.message;
      clearPendingAnalysis();

      if (!isSessionActive) {
        try {
          await startSession(currentCluster.context, pendingAnalysis.namespace);
        } catch {
          return;
        }
      }

      try {
        await sendMessage(message);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send message");
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
