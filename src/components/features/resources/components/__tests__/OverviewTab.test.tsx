import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverviewTab } from "../OverviewTab";
import { getPod } from "@/lib/tauri/commands";
import type { ResourceData } from "../../types";
import type { PodInfo } from "@/lib/types";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@/components/providers/I18nProvider", () => ({
  useLocale: () => "en",
}));

jest.mock("@/lib/tauri/commands", () => ({
  getPod: jest.fn(),
}));

jest.mock("../PodMetricsSection", () => ({
  PodMetricsSection: () => null,
}));

jest.mock("../ContainerStatusSection", () => ({
  ContainerStatusSection: () => null,
}));

const makePodInfo = (overrides: Partial<PodInfo> = {}): PodInfo => ({
  name: "demo-api-abc123",
  namespace: "kubeli-demo",
  uid: "pod-uid",
  phase: "Running",
  node_name: "minikube",
  pod_ip: "10.244.0.5",
  host_ip: "192.168.49.2",
  init_containers: [],
  containers: [],
  created_at: null,
  deletion_timestamp: null,
  labels: {},
  restart_count: 0,
  ready_containers: "0/0",
  service_account: "demo-sa",
  node_selector: { "kubernetes.io/os": "linux" },
  tolerations: [
    {
      key: "node.kubernetes.io/not-ready",
      operator: "Exists",
      value: null,
      effect: "NoExecute",
      toleration_seconds: 300,
    },
  ],
  ...overrides,
});

const resource: ResourceData = {
  name: "demo-api-abc123",
  namespace: "kubeli-demo",
  uid: "pod-uid",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("OverviewTab scheduling section", () => {
  it("renders serviceAccount, nodeSelector and tolerations for pods", async () => {
    (getPod as jest.Mock).mockResolvedValue(makePodInfo());

    render(<OverviewTab resource={resource} resourceType="pod" />);

    await waitFor(() =>
      expect(screen.getByText("podDetail.scheduling")).toBeTruthy()
    );

    expect(screen.getByText("podDetail.serviceAccount")).toBeTruthy();
    expect(screen.getByText("demo-sa")).toBeTruthy();

    expect(screen.getByText("podDetail.nodeSelector")).toBeTruthy();
    expect(screen.getByText("kubernetes.io/os=linux")).toBeTruthy();

    expect(screen.getByText("podDetail.tolerations")).toBeTruthy();
    expect(
      screen.getByText("node.kubernetes.io/not-ready Exists")
    ).toBeTruthy();
    expect(screen.getByText("NoExecute")).toBeTruthy();
    expect(screen.getByText("300s")).toBeTruthy();
  });

  it("navigates to the ServiceAccount when the link is clicked", async () => {
    (getPod as jest.Mock).mockResolvedValue(makePodInfo());
    const onNavigateToOwner = jest.fn();

    render(
      <OverviewTab
        resource={resource}
        resourceType="pod"
        onNavigateToOwner={onNavigateToOwner}
      />
    );

    const link = await screen.findByRole("button", { name: "demo-sa" });
    await userEvent.click(link);

    expect(onNavigateToOwner).toHaveBeenCalledWith(
      "ServiceAccount",
      "demo-sa",
      "kubeli-demo"
    );
  });

  it("omits the scheduling section when the pod has no scheduling data", async () => {
    (getPod as jest.Mock).mockResolvedValue(
      makePodInfo({ service_account: null, node_selector: {}, tolerations: [] })
    );

    render(<OverviewTab resource={resource} resourceType="pod" />);

    await waitFor(() => expect(getPod).toHaveBeenCalled());
    expect(screen.queryByText("podDetail.scheduling")).toBeNull();
  });

  it("does not render the scheduling section for non-pod resources", () => {
    render(<OverviewTab resource={resource} resourceType="deployment" />);

    expect(getPod).not.toHaveBeenCalled();
    expect(screen.queryByText("podDetail.scheduling")).toBeNull();
  });
});
