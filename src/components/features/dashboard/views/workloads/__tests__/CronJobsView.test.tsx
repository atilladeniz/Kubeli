import { render, waitFor } from "@testing-library/react";
import { CronJobsView } from "../CronJobsView";
import {
  getCronjobJobYaml,
  suspendCronjob,
  resumeCronjob,
  triggerCronjob,
} from "@/lib/tauri/commands";
import { useUIStore } from "@/lib/stores/ui-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import type { ContextMenuItemDef } from "../../../../resources/columns";
import type { CronJobInfo } from "@/lib/types";

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
  triggerCronjob: jest.fn().mockResolvedValue(undefined),
  suspendCronjob: jest.fn().mockResolvedValue(undefined),
  resumeCronjob: jest.fn().mockResolvedValue(undefined),
  getCronjobJobYaml: jest.fn().mockResolvedValue("apiVersion: batch/v1\nkind: Job\n"),
}));

const makeCronJob = (suspend: boolean): CronJobInfo => ({
  name: "demo-cleanup",
  namespace: "kubeli-demo",
  uid: "uid-1",
  schedule: "0 * * * *",
  suspend,
  active_jobs: 0,
  last_schedule_time: null,
  last_successful_time: null,
  created_at: null,
  labels: {},
});

let mockData: CronJobInfo[] = [];
jest.mock("@/lib/hooks/useK8sResources", () => ({
  useCronJobs: () => ({
    data: mockData,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    retry: jest.fn(),
  }),
}));

let capturedContextMenuItems:
  | ((cj: CronJobInfo) => ContextMenuItemDef[])
  | undefined;
jest.mock("../../../../resources/ResourceList", () => ({
  ResourceList: (props: {
    contextMenuItems?: (cj: CronJobInfo) => ContextMenuItemDef[];
  }) => {
    capturedContextMenuItems = props.contextMenuItems;
    return null;
  },
}));

const menuFor = (suspend: boolean) => {
  mockData = [makeCronJob(suspend)];
  render(<CronJobsView />);
  return capturedContextMenuItems!(mockData[0]);
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("CronJobsView actions", () => {
  it("triggers a job from the cronjob", async () => {
    menuFor(false)
      .find((i) => i.label === "workloads.trigger")!
      .onClick();

    await waitFor(() =>
      expect(triggerCronjob).toHaveBeenCalledWith("demo-cleanup", "kubeli-demo")
    );
  });

  it("opens the create panel pre-filled with the generated job YAML", async () => {
    const openCreateResourceWithYaml = jest.fn();
    useUIStore.setState({ openCreateResourceWithYaml });

    menuFor(false)
      .find((i) => i.label === "workloads.editTrigger")!
      .onClick();

    await waitFor(() =>
      expect(openCreateResourceWithYaml).toHaveBeenCalledWith(
        "apiVersion: batch/v1\nkind: Job\n"
      )
    );
    expect(getCronjobJobYaml).toHaveBeenCalledWith("demo-cleanup", "kubeli-demo");
  });

  it("does not open the panel when the cluster changed while loading YAML", async () => {
    const openCreateResourceWithYaml = jest.fn();
    useUIStore.setState({ openCreateResourceWithYaml });
    useClusterStore.setState({
      currentCluster: { context: "cluster-a" } as never,
    });
    (getCronjobJobYaml as jest.Mock).mockImplementation(async () => {
      // Simulate a cluster switch during the backend round-trip
      useClusterStore.setState({
        currentCluster: { context: "cluster-b" } as never,
      });
      return "kind: Job\n";
    });

    menuFor(false)
      .find((i) => i.label === "workloads.editTrigger")!
      .onClick();

    await waitFor(() => expect(getCronjobJobYaml).toHaveBeenCalled());
    expect(openCreateResourceWithYaml).not.toHaveBeenCalled();
  });

  it("offers Suspend for an active cronjob and Resume for a suspended one", async () => {
    const active = menuFor(false);
    expect(active.find((i) => i.label === "workloads.resume")).toBeUndefined();
    active.find((i) => i.label === "workloads.suspend")!.onClick();
    await waitFor(() =>
      expect(suspendCronjob).toHaveBeenCalledWith("demo-cleanup", "kubeli-demo")
    );

    const suspended = menuFor(true);
    expect(suspended.find((i) => i.label === "workloads.suspend")).toBeUndefined();
    suspended.find((i) => i.label === "workloads.resume")!.onClick();
    await waitFor(() =>
      expect(resumeCronjob).toHaveBeenCalledWith("demo-cleanup", "kubeli-demo")
    );
  });
});
