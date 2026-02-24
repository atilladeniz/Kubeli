"use client";

import { useCallback, useRef } from "react";
import { useAIStore } from "@/lib/stores/ai-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import type { ViewContext } from "./useViewContext";
import { buildViewContextPrefix } from "../utils/buildViewContextPrefix";

interface UseAISessionOptions {
  onError?: (error: string) => void;
  fallbackErrorMessage?: string;
  viewContext?: ViewContext;
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

      // Build context-enriched message for the AI
      let enrichedMessage = message;
      if (options.viewContext) {
        const prefix = buildViewContextPrefix(options.viewContext);
        if (prefix) {
          enrichedMessage = prefix + message;
        }
      }

      // Send message - enriched goes to AI, original displays in UI
      try {
        await sendMessage(
          enrichedMessage,
          enrichedMessage !== message ? message : undefined
        );
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
