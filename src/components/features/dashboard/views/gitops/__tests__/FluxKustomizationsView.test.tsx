import { render, waitFor } from "@testing-library/react";
import { FluxKustomizationsView } from "../FluxKustomizationsView";
import {
  reconcileFluxKustomization,
  resumeFluxKustomization,
} from "@/lib/tauri/commands";
import type { ContextMenuItemDef } from "../../../../resources/columns";
import type { FluxKustomizationInfo } from "@/lib/types";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
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
  reconcileFluxKustomization: jest.fn(),
  suspendFluxKustomization: jest.fn(),
  resumeFluxKustomization: jest.fn(),
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
jest.mock("../../../../resources/ResourceList", () => ({
  ResourceList: (props: {
    contextMenuItems?: (k: FluxKustomizationInfo) => ContextMenuItemDef[];
  }) => {
    capturedContextMenuItems = props.contextMenuItems;
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
});

describe("FluxKustomizationsView reconcile action", () => {
  it("resumes before reconciling a suspended kustomization", async () => {
    const item = menuFor(true).find((i) => i.label === "Resume & Reconcile")!;
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
    const item = menuFor(false).find((i) => i.label === "Reconcile")!;

    item.onClick();
    await waitFor(() =>
      expect(reconcileFluxKustomization).toHaveBeenCalledWith("apps", "flux-system")
    );
    expect(resumeFluxKustomization).not.toHaveBeenCalled();
  });
});
