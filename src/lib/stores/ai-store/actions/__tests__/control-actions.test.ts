import { createControlActions } from "../control-actions";

function createHarness(overrides: Record<string, unknown> = {}) {
  const state = {
    pendingAnalysis: { message: "check", clusterContext: "kind" },
    error: null,
    ...overrides,
  };

  const set = (update: unknown) => {
    if (typeof update === "function") {
      Object.assign(state, update(state));
      return;
    }
    Object.assign(state, update);
  };

  return {
    state,
    actions: createControlActions(set as never, (() => state) as never),
  };
}

describe("createControlActions", () => {
  it("manages pending analysis state", () => {
    const analysis = { message: "inspect", clusterContext: "demo" };
    const { state, actions } = createHarness();

    actions.setPendingAnalysis(analysis as never);
    expect(actions.getPendingAnalysis()).toEqual(analysis);
    actions.clearPendingAnalysis();
    expect(state.pendingAnalysis).toBeNull();
  });

  it("allows direct error set and reset", () => {
    const { state, actions } = createHarness();

    actions.setError("manual");
    expect(state.error).toBe("manual");
    actions.clearError();
    expect(state.error).toBeNull();
  });
});
