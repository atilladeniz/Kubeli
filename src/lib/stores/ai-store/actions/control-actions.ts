import type { AISetState, AIState } from "../types";

type ControlActions = Pick<
  AIState,
  | "setPendingAnalysis"
  | "clearPendingAnalysis"
  | "setError"
  | "clearError"
>;

export function createControlActions(set: AISetState): ControlActions {
  return {
    setPendingAnalysis: (analysis) => {
      set({ pendingAnalysis: analysis });
    },

    clearPendingAnalysis: () => {
      set({ pendingAnalysis: null });
    },

    setError: (error: string | null) => {
      set({ error });
    },

    clearError: () => {
      set({ error: null });
    },
  };
}
