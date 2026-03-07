jest.mock("../../../../tauri/commands", () => ({
  aiApproveAction: jest.fn(),
  aiGetPermissionMode: jest.fn(),
  aiRejectAction: jest.fn(),
  aiSetPermissionMode: jest.fn(),
}));

import {
  aiApproveAction,
  aiGetPermissionMode,
  aiRejectAction,
  aiSetPermissionMode,
} from "../../../../tauri/commands";
import { createControlActions } from "../control-actions";

function createHarness(overrides: Record<string, unknown> = {}) {
  const state = {
    permissionMode: "default",
    pendingApproval: { request_id: "req-1" },
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads and stores the permission mode", async () => {
    (aiGetPermissionMode as jest.Mock).mockResolvedValue("plan");
    const { state, actions } = createHarness();

    await expect(actions.getPermissionMode()).resolves.toBe("plan");
    expect(state.permissionMode).toBe("plan");
  });

  it("falls back to current permission mode when loading fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    (aiGetPermissionMode as jest.Mock).mockRejectedValue(new Error("nope"));
    const { actions } = createHarness({ permissionMode: "acceptedits" });

    await expect(actions.getPermissionMode()).resolves.toBe("acceptedits");
  });

  it("updates the permission mode and records API errors", async () => {
    const { state, actions } = createHarness();

    await actions.setPermissionMode("plan");
    expect(aiSetPermissionMode).toHaveBeenCalledWith("plan");
    expect(state.permissionMode).toBe("plan");

    (aiSetPermissionMode as jest.Mock).mockRejectedValueOnce(new Error("blocked"));
    await actions.setPermissionMode("acceptedits");
    expect(state.error).toBe("blocked");
  });

  it("manages approvals and pending analysis state", async () => {
    const approval = { request_id: "req-2" };
    const analysis = { message: "inspect", clusterContext: "demo" };
    const { state, actions } = createHarness();

    actions.setApprovalRequest(approval as never);
    expect(state.pendingApproval).toEqual(approval);

    await actions.approveAction("req-2");
    expect(aiApproveAction).toHaveBeenCalledWith("req-2");
    expect(state.pendingApproval).toBeNull();

    actions.setApprovalRequest(approval as never);
    await actions.rejectAction("req-2", "unsafe");
    expect(aiRejectAction).toHaveBeenCalledWith("req-2", "unsafe");
    expect(state.pendingApproval).toBeNull();

    actions.setPendingAnalysis(analysis as never);
    expect(actions.getPendingAnalysis()).toEqual(analysis);
    actions.clearPendingAnalysis();
    expect(state.pendingAnalysis).toBeNull();
  });

  it("stores approval errors and allows direct error reset helpers", async () => {
    (aiApproveAction as jest.Mock).mockRejectedValueOnce(new Error("approve failed"));
    (aiRejectAction as jest.Mock).mockRejectedValueOnce(new Error("reject failed"));
    const { state, actions } = createHarness();

    await actions.approveAction("req-3");
    expect(state.error).toBe("approve failed");

    await actions.rejectAction("req-3");
    expect(state.error).toBe("reject failed");

    actions.setError("manual");
    expect(state.error).toBe("manual");
    actions.clearError();
    expect(state.error).toBeNull();
  });
});
