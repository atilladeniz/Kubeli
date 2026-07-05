import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAIStore } from "@/lib/stores/ai-store";
import type { AIEventData } from "../types";

interface AIEventsI18n {
  unknownError: string;
}

/**
 * Hook that subscribes to AI session events from the Tauri backend.
 * Handles message chunks, thinking state, tool execution and errors.
 *
 * @param sessionId - Current AI session ID (null if no session active)
 * @param i18n - Translated strings for error messages
 */
export function useAIEvents(sessionId: string | null, i18n: AIEventsI18n) {
  const appendMessageChunk = useAIStore((s) => s.appendMessageChunk);
  const finalizeStreaming = useAIStore((s) => s.finalizeStreaming);
  const setThinking = useAIStore((s) => s.setThinking);
  const setError = useAIStore((s) => s.setError);
  const addToolCall = useAIStore((s) => s.addToolCall);
  const markSessionEnded = useAIStore((s) => s.markSessionEnded);

  useEffect(() => {
    if (!sessionId) return;

    const eventName = `ai-session-${sessionId}`;

    const unlisten = listen<AIEventData>(eventName, (event) => {
      const { type, data } = event.payload;

      switch (type) {
        case "MessageChunk":
          appendMessageChunk(data.content || "", data.done || false);
          break;

        case "Thinking":
          setThinking(data.active || false);
          break;

        case "ToolExecution":
          addToolCall({
            name: data.tool_name || "unknown",
            status: data.status || "running",
            output: data.output,
          });
          break;

        case "Error":
          setError(data.message || i18n.unknownError);
          // The stream is dead - unstick the streaming/thinking flags and
          // finalize the in-flight assistant message.
          finalizeStreaming();
          break;

        case "SessionEnded":
          markSessionEnded();
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [
    sessionId,
    appendMessageChunk,
    finalizeStreaming,
    setThinking,
    setError,
    addToolCall,
    markSessionEnded,
    i18n,
  ]);
}
