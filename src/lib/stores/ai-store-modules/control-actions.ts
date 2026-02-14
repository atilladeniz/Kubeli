import {
  aiApproveAction,
  aiGetPermissionMode,
  aiRejectAction,
  aiSetPermissionMode,
} from "../../tauri/commands";
import { getErrorMessage } from "./helpers";
import type { AIGetState, AISetState, AIState } from "./types";

type ControlActions = Pick<
  AIState,
  | "getPermissionMode"
  | "setPermissionMode"
  | "setApprovalRequest"
  | "approveAction"
  | "rejectAction"
  | "setPendingAnalysis"
  | "clearPendingAnalysis"
  | "getPendingAnalysis"
  | "setError"
  | "clearError"
>;

export function createControlActions(
  set: AISetState,
  get: AIGetState
): ControlActions {
  return {
    getPermissionMode: async () => {
      try {
        const mode = await aiGetPermissionMode();
        set({ permissionMode: mode });
        return mode;
      } catch (error) {
        console.error("Failed to get permission mode:", error);
        return get().permissionMode;
      }
    },

    setPermissionMode: async (mode) => {
      try {
        await aiSetPermissionMode(mode);
        set({ permissionMode: mode });
      } catch (error) {
        set({ error: getErrorMessage(error, "Failed to set permission mode") });
      }
    },

    setApprovalRequest: (request) => {
      set({ pendingApproval: request });
    },

    approveAction: async (requestId: string) => {
      try {
        await aiApproveAction(requestId);
        set({ pendingApproval: null });
      } catch (error) {
        set({ error: getErrorMessage(error, "Failed to approve action") });
      }
    },

    rejectAction: async (requestId: string, reason?: string) => {
      try {
        await aiRejectAction(requestId, reason);
        set({ pendingApproval: null });
      } catch (error) {
        set({ error: getErrorMessage(error, "Failed to reject action") });
      }
    },

    setPendingAnalysis: (analysis) => {
      set({ pendingAnalysis: analysis });
    },

    clearPendingAnalysis: () => {
      set({ pendingAnalysis: null });
    },

    getPendingAnalysis: () => {
      return get().pendingAnalysis;
    },

    setError: (error: string | null) => {
      set({ error });
    },

    clearError: () => {
      set({ error: null });
    },
  };
}
