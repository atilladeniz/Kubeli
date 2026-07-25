import { render, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { HelmReleasesView } from "../HelmReleasesView";
import {
  reconcileFluxHelmRelease,
  reconcileFluxHelmReleaseWithSource,
  forceFluxHelmRelease,
  resetFluxHelmRelease,
  resumeFluxHelmRelease,
  waitFluxReconcile,
} from "@/lib/tauri/commands";
import type { ContextMenuItemDef } from "../../../../resources/columns";
import type { HelmReleaseInfo } from "@/lib/types";

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
    handleUninstallFromContext: jest.fn(),
  }),
}));

jest.mock("@/lib/tauri/commands", () => ({
  reconcileFluxHelmRelease: jest.fn().mockResolvedValue("token-1"),
  reconcileFluxHelmReleaseWithSource: jest.fn().mockResolvedValue("token-1"),
  forceFluxHelmRelease: jest.fn().mockResolvedValue("token-1"),
  resetFluxHelmRelease: jest.fn().mockResolvedValue("token-1"),
  suspendFluxHelmRelease: jest.fn(),
  resumeFluxHelmRelease: jest.fn(),
  waitFluxReconcile: jest
    .fn()
    .mockResolvedValue({ outcome: "succeeded", message: null }),
}));

const makeRelease = (suspended: boolean): HelmReleaseInfo => ({
  name: "podinfo",
  namespace: "default",
  revision: 3,
  status: "deployed",
  chart: "podinfo",
  chart_version: "6.5.0",
  app_version: "6.5.0",
  first_deployed: null,
  last_deployed: null,
  description: "",
  notes: null,
  managed_by: "flux",
  suspended,
});

let mockData: HelmReleaseInfo[] = [];
jest.mock("@/lib/hooks/useK8sResources", () => ({
  useHelmReleases: () => ({
    data: mockData,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    retry: jest.fn(),
  }),
}));

let capturedContextMenuItems:
  | ((r: HelmReleaseInfo) => ContextMenuItemDef[])
  | undefined;
jest.mock("../../../../resources/ResourceList", () => ({
  ResourceList: (props: {
    contextMenuItems?: (r: HelmReleaseInfo) => ContextMenuItemDef[];
  }) => {
    capturedContextMenuItems = props.contextMenuItems;
    return null;
  },
}));

const menuFor = (suspended: boolean) => {
  mockData = [makeRelease(suspended)];
  render(<HelmReleasesView />);
  return capturedContextMenuItems!(mockData[0]);
};

beforeEach(() => {
  jest.clearAllMocks();
  for (const mock of [
    reconcileFluxHelmRelease,
    reconcileFluxHelmReleaseWithSource,
    forceFluxHelmRelease,
    resetFluxHelmRelease,
  ]) {
    (mock as jest.Mock).mockResolvedValue("token-1");
  }
  (waitFluxReconcile as jest.Mock).mockResolvedValue({
    outcome: "succeeded",
    message: null,
  });
});

describe("HelmReleasesView Flux actions", () => {
  it("forces a one-off install/upgrade", async () => {
    menuFor(false)
      .find((i) => i.label === "flux.forceReconcile")!
      .onClick();

    await waitFor(() =>
      expect(forceFluxHelmRelease).toHaveBeenCalledWith("podinfo", "default")
    );
    expect(reconcileFluxHelmRelease).not.toHaveBeenCalled();
  });

  it("resets the retry counter with its own toast", async () => {
    menuFor(false)
      .find((i) => i.label === "flux.resetRetries")!
      .onClick();

    await waitFor(() =>
      expect(resetFluxHelmRelease).toHaveBeenCalledWith("podinfo", "default")
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("flux.resetTriggered", {
        description: "podinfo",
      })
    );
  });

  it("reconciles the chart source first via Reconcile with Source", async () => {
    menuFor(false)
      .find((i) => i.label === "flux.reconcileWithSource")!
      .onClick();

    await waitFor(() =>
      expect(reconcileFluxHelmReleaseWithSource).toHaveBeenCalledWith(
        "podinfo",
        "default"
      )
    );
  });

  it("resumes a suspended release before any reconcile variant", async () => {
    menuFor(true)
      .find((i) => i.label === "flux.forceReconcile")!
      .onClick();

    await waitFor(() =>
      expect(forceFluxHelmRelease).toHaveBeenCalledWith("podinfo", "default")
    );
    expect(resumeFluxHelmRelease).toHaveBeenCalledWith("podinfo", "default");
    expect(
      (resumeFluxHelmRelease as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan((forceFluxHelmRelease as jest.Mock).mock.invocationCallOrder[0]);
  });

  it("follows up with the reconcile outcome", async () => {
    (waitFluxReconcile as jest.Mock).mockResolvedValue({
      outcome: "failed",
      message: "install retries exhausted",
    });

    menuFor(false)
      .find((i) => i.label === "flux.reconcile")!
      .onClick();

    await waitFor(() =>
      expect(waitFluxReconcile).toHaveBeenCalledWith(
        "helmrelease",
        "podinfo",
        "default",
        "token-1"
      )
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("flux.reconcileError", {
        description: "install retries exhausted",
      })
    );
  });

  it("hides Flux actions for plain Helm releases", () => {
    mockData = [{ ...makeRelease(false), managed_by: "helm" }];
    render(<HelmReleasesView />);
    const items = capturedContextMenuItems!(mockData[0]);

    expect(items.find((i) => i.label === "flux.reconcile")).toBeUndefined();
    expect(items.find((i) => i.label === "flux.forgetRelease")).toBeDefined();
  });
});
