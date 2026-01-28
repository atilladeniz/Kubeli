import { useState, useEffect, useMemo } from "react";
import { THINKING_MESSAGE_INTERVAL } from "../types";

/**
 * Hook that cycles through thinking messages while AI is processing.
 * Returns the current thinking message string.
 *
 * @param isProcessing - Whether the AI is currently thinking/streaming
 * @param messages - Array of translated thinking messages
 * @returns Current thinking message
 */
export function useThinkingMessage(
  isProcessing: boolean,
  messages: readonly string[]
): string {
  const [messageIndex, setMessageIndex] = useState(0);

  const messageCount = useMemo(() => messages.length, [messages]);

  useEffect(() => {
    if (!isProcessing) return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messageCount);
    }, THINKING_MESSAGE_INTERVAL);

    return () => {
      clearInterval(interval);
      setMessageIndex(0);
    };
  }, [isProcessing, messageCount]);

  return messages[messageIndex] || messages[0];
}
