import type { AIGetState, AISetState, AIState } from "../types";

type ControlActions = Pick<
  AIState,
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
