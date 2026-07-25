import { render, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { FluxKustomizationsView } from "../FluxKustomizationsView";
import {
  reconcileFluxKustomization,
  reconcileFluxKustomizationWithSource,
  resumeFluxKustomization,
  waitFluxReconcile,
} from "@/lib/tauri/commands";
import { useClusterStore } from "@/lib/stores/cluster-store";
import type { ContextMenuItemDef } from "../../../../resources/columns";
import type { FluxKustomizationInfo } from "@/lib/types";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock("@/lib/hooks/useRefreshOnDelete", () => ({
  useRefreshOnDelete: jest.fn(),
}));

jest.mock("../../../context", () => ({
  useResourceDetail: () => ({
    openResourceDetail: jest.fn(),
    handleDeleteFromContext: jest.fn(),
  }),
}));

jest.mock("@/lib/tauri/commands", () => ({
  reconcileFluxKustomization: jest.fn().mockResolvedValue("token-1"),
  reconcileFluxKustomizationWithSource: jest.fn().mockResolvedValue("token-1"),
  suspendFluxKustomization: jest.fn(),
  resumeFluxKustomization: jest.fn(),
  waitFluxReconcile: jest
    .fn()
    .mockResolvedValue({ outcome: "succeeded", message: null }),
}));

const makeKustomization = (suspended: boolean): FluxKustomizationInfo => ({
  name: "apps",
  namespace: "flux-system",
  path: "./apps",
  source_ref: "GitRepository/flux-system/flux-system",
  interval: "10m",
  status: "ready",
  suspended,
  message: null,
  last_applied_revision: null,
  created_at: null,
});

let mockData: FluxKustomizationInfo[] = [];
jest.mock("@/lib/hooks/useK8sResources", () => ({
  useFluxKustomizations: () => ({
    data: mockData,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    retry: jest.fn(),
  }),
}));

let capturedContextMenuItems:
  | ((k: FluxKustomizationInfo) => ContextMenuItemDef[])
  | undefined;
let capturedData: FluxKustomizationInfo[] = [];
jest.mock("../../../../resources/ResourceList", () => ({
  ResourceList: (props: {
    data: FluxKustomizationInfo[];
    contextMenuItems?: (k: FluxKustomizationInfo) => ContextMenuItemDef[];
  }) => {
    capturedContextMenuItems = props.contextMenuItems;
    capturedData = props.data;
    return null;
  },
}));

const menuFor = (suspended: boolean) => {
  mockData = [makeKustomization(suspended)];
  render(<FluxKustomizationsView />);
  return capturedContextMenuItems!(mockData[0]);
};

beforeEach(() => {
  jest.clearAllMocks();
  (reconcileFluxKustomization as jest.Mock).mockResolvedValue("token-1");
  (reconcileFluxKustomizationWithSource as jest.Mock).mockResolvedValue("token-1");
  (waitFluxReconcile as jest.Mock).mockResolvedValue({
    outcome: "succeeded",
    message: null,
  });
});

describe("FluxKustomizationsView reconcile action", () => {
  it("resumes before reconciling a suspended kustomization", async () => {
    const item = menuFor(true).find((i) => i.label === "flux.resumeReconcile")!;
    expect(item.disabled).toBeFalsy();

    item.onClick();
    await waitFor(() =>
      expect(reconcileFluxKustomization).toHaveBeenCalledWith("apps", "flux-system")
    );
    expect(resumeFluxKustomization).toHaveBeenCalledWith("apps", "flux-system");
    // Resume must run first — Flux ignores reconcile requests while suspended
    expect(
      (resumeFluxKustomization as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan(
      (reconcileFluxKustomization as jest.Mock).mock.invocationCallOrder[0]
    );
  });

  it("reconciles directly when not suspended", async () => {
    const item = menuFor(false).find((i) => i.label === "flux.reconcile")!;

    item.onClick();
    await waitFor(() =>
      expect(reconcileFluxKustomization).toHaveBeenCalledWith("apps", "flux-system")
    );
    expect(resumeFluxKustomization).not.toHaveBeenCalled();
  });

  it("reconciles the source first via Reconcile with Source", async () => {
    const item = menuFor(false).find(
      (i) => i.label === "flux.reconcileWithSource"
    )!;

    item.onClick();
    await waitFor(() =>
      expect(reconcileFluxKustomizationWithSource).toHaveBeenCalledWith(
        "apps",
        "flux-system"
      )
    );
    expect(reconcileFluxKustomization).not.toHaveBeenCalled();
  });

  it("follows up with the reconcile outcome", async () => {
    (waitFluxReconcile as jest.Mock).mockResolvedValue({
      outcome: "failed",
      message: "health check failed",
    });

    menuFor(false)
      .find((i) => i.label === "flux.reconcile")!
      .onClick();

    await waitFor(() =>
      expect(waitFluxReconcile).toHaveBeenCalledWith(
        "kustomization",
        "apps",
        "flux-system",
        "token-1"
      )
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("flux.reconcileError", {
        description: "health check failed",
      })
    );
  });

  it("drops the outcome toast when the cluster changed while waiting", async () => {
    useClusterStore.setState({
      currentCluster: { context: "cluster-a" } as never,
    });
    (waitFluxReconcile as jest.Mock).mockImplementation(async () => {
      // Simulate a cluster switch during the wait
      useClusterStore.setState({
        currentCluster: { context: "cluster-b" } as never,
      });
      return { outcome: "succeeded", message: null };
    });

    menuFor(false)
      .find((i) => i.label === "flux.reconcile")!
      .onClick();

    await waitFor(() => expect(waitFluxReconcile).toHaveBeenCalled());
    // Flush the microtasks that would show the outcome toast
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Only the "triggered" toast — no outcome toast for another cluster's view
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("flux.reconcileTriggered", {
      description: "apps",
    });
  });

  it("reports when the result could not be verified instead of staying silent", async () => {
    (waitFluxReconcile as jest.Mock).mockRejectedValue(new Error("connection lost"));

    menuFor(false)
      .find((i) => i.label === "flux.reconcile")!
      .onClick();

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith("flux.resultUnknown", {
        description: "apps",
      })
    );
  });

  it("disables reconcile actions while one is in flight", async () => {
    // Keep the wait pending so the action stays in flight
    (waitFluxReconcile as jest.Mock).mockImplementation(() => new Promise(() => {}));

    menuFor(false)
      .find((i) => i.label === "flux.reconcile")!
      .onClick();
    await waitFor(() =>
      expect(reconcileFluxKustomization).toHaveBeenCalledTimes(1)
    );

    // The rebuilt menu disables both reconcile variants for this resource
    await waitFor(() => {
      const rebuilt = capturedContextMenuItems!(mockData[0]);
      expect(rebuilt.find((i) => i.label === "flux.reconcile")!.disabled).toBe(true);
      expect(
        rebuilt.find((i) => i.label === "flux.reconcileWithSource")!.disabled
      ).toBe(true);
    });

    // A second click while in flight is a no-op
    capturedContextMenuItems!(mockData[0])
      .find((i) => i.label === "flux.reconcile")!
      .onClick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(reconcileFluxKustomization).toHaveBeenCalledTimes(1);
  });

  it("maps suspended resources to a suspended status for sort and search", () => {
    menuFor(true);
    expect(capturedData[0].status).toBe("suspended");

    menuFor(false);
    expect(capturedData[0].status).toBe("ready");
  });
});
