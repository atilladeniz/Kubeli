"use client";

import { useCallback, useRef } from "react";
import { useAIStore } from "@/lib/stores/ai-store";
import { useClusterStore } from "@/lib/stores/cluster-store";

interface UseAISessionOptions {
  onError?: (error: string) => void;
  fallbackErrorMessage?: string;
}

/**
 * Hook that encapsulates AI session management logic.
 * Handles starting sessions, sending messages, and textarea reset.
 */
export function useAISession(options: UseAISessionOptions = {}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isSessionActive,
    isStreaming,
    startSession,
    sendMessage,
    setError,
  } = useAIStore();

  const { currentCluster, currentNamespace } = useClusterStore();

  const handleSend = useCallback(
    async (input: string) => {
      if (!input.trim() || isStreaming) return false;

      const message = input.trim();

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      // Start session if needed
      if (!isSessionActive && currentCluster) {
        try {
          await startSession(currentCluster.context, currentNamespace || undefined);
        } catch {
          return false;
        }
      }

      // Send message
      try {
        await sendMessage(message);
        return true;
      } catch (e) {
        const errorMsg =
          e instanceof Error
            ? e.message
            : options.fallbackErrorMessage || "Failed to send message";
        setError(errorMsg);
        options.onError?.(errorMsg);
        return false;
      }
    },
    [
      isStreaming,
      isSessionActive,
      currentCluster,
      currentNamespace,
      startSession,
      sendMessage,
      setError,
      options,
    ]
  );

  return {
    textareaRef,
    handleSend,
    canSend: !!currentCluster && !isStreaming,
  };
}
