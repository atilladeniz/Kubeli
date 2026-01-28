import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { useAIStore } from "@/lib/stores/ai-store";
import type { AIEventData } from "../types";

interface AIEventsCallbacks {
  /** Called when approval modal should open */
  onApprovalRequired: () => void;
  /** Called when approval response is received */
  onApprovalResponse: (approved: boolean) => void;
}

interface AIEventsI18n {
  actionApproved: string;
  actionDenied: string;
  blocked: string;
  noPermission: string;
}

/**
 * Hook that subscribes to AI session events from the Tauri backend.
 * Handles message chunks, thinking state, tool execution, approvals, and errors.
 *
 * @param sessionId - Current AI session ID (null if no session active)
 * @param callbacks - Callbacks for UI state changes
 * @param i18n - Translated strings for toast messages
 */
export function useAIEvents(
  sessionId: string | null,
  callbacks: AIEventsCallbacks,
  i18n: AIEventsI18n
) {
  const {
    appendMessageChunk,
    setThinking,
    setError,
    addToolCall,
    setApprovalRequest,
  } = useAIStore();

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

        case "ApprovalRequired":
          if (data.request_id && data.tool_name) {
            setApprovalRequest({
              request_id: data.request_id,
              session_id: sessionId,
              tool_name: data.tool_name,
              tool_input: data.tool_input || {},
              command_preview: data.command_preview || "",
              reason: data.reason || "Action requires approval",
              severity: data.severity || "medium",
            });
            callbacks.onApprovalRequired();
          }
          break;

        case "ApprovalResponse":
          callbacks.onApprovalResponse(data.approved || false);
          if (data.approved) {
            toast.success(i18n.actionApproved);
          } else {
            toast.info(i18n.actionDenied);
          }
          break;

        case "ToolBlocked":
          toast.error(`${i18n.blocked}: ${data.reason || i18n.noPermission}`);
          addToolCall({
            name: data.tool_name || "blocked",
            status: "failed",
            output: data.reason || "Action was blocked by permission system",
          });
          break;

        case "Error":
          setError(data.message || "Unknown error");
          break;

        case "SessionEnded":
          // Session ended, parent component handles state reset
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [
    sessionId,
    appendMessageChunk,
    setThinking,
    setError,
    addToolCall,
    setApprovalRequest,
    callbacks,
    i18n,
  ]);
}
