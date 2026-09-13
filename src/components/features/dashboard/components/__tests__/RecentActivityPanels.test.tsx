import { fireEvent, render, screen } from "@testing-library/react";
import { RecentRestartsPanel, RecentWarningsPanel } from "../RecentActivityPanels";
import { PANEL_LIMIT } from "../recent-activity";
import type { ContainerInfo, EventInfo, PodInfo } from "@/lib/types";

const openResourceDetail = jest.fn();

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

jest.mock("../../context/ResourceDetailContext", () => ({
  useResourceDetail: () => ({ openResourceDetail }),
}));

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const container = (overrides: Partial<ContainerInfo> = {}): ContainerInfo => ({
  name: "app",
  image: "demo:1",
  ready: true,
  restart_count: 0,
  state: "Running",
  state_reason: null,
  last_state: null,
  last_state_reason: null,
  last_exit_code: null,
  last_finished_at: null,
  env_vars: [],
  ports: [],
  ...overrides,
});

const pod = (name: string, overrides: Partial<PodInfo> = {}): PodInfo => ({
  name,
  namespace: "kubeli-demo",
  uid: `uid-${name}`,
  phase: "Running",
  node_name: "minikube",
  pod_ip: null,
  host_ip: null,
  init_containers: [],
  containers: [container({ last_finished_at: minutesAgo(10), last_state_reason: "OOMKilled" })],
  created_at: null,
  deletion_timestamp: null,
  labels: {},
  restart_count: 3,
  ready_containers: "1/1",
  service_account: null,
  node_selector: {},
  tolerations: [],
  ...overrides,
});

const event = (name: string, overrides: Partial<EventInfo> = {}): EventInfo => ({
  name: `evt-${name}`,
  namespace: "kubeli-demo",
  uid: `evt-uid-${name}`,
  event_type: "Warning",
  reason: "BackOff",
  message: "Back-off restarting failed container",
  involved_object: { kind: "Pod", name, namespace: "kubeli-demo", uid: null },
  count: 1,
  first_timestamp: minutesAgo(20),
  last_timestamp: minutesAgo(20),
  source_component: "kubelet",
  source_host: null,
  created_at: null,
  ...overrides,
});

beforeEach(() => {
  openResourceDetail.mockClear();
});

describe("RecentRestartsPanel", () => {
  it("shows the empty state when nothing restarted", () => {
    render(<RecentRestartsPanel pods={[pod("calm", { restart_count: 0 })]} />);

    expect(screen.getByText("noRestarts")).toBeInTheDocument();
    expect(screen.queryAllByTestId("restart-row")).toHaveLength(0);
  });

  it("lists restarted pods with count and reason, and opens the pod on click", () => {
    render(<RecentRestartsPanel pods={[pod("demo-web")]} />);

    expect(screen.getByText("3x")).toBeInTheDocument();
    expect(screen.getByText("OOMKilled")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "demo-web" }));
    expect(openResourceDetail).toHaveBeenCalledWith("pod", "demo-web", "kubeli-demo");
  });

  it("caps the list and expands on show all", () => {
    const pods = Array.from({ length: PANEL_LIMIT + 4 }, (_, i) => pod(`pod-${i}`));
    render(<RecentRestartsPanel pods={pods} />);

    expect(screen.queryAllByTestId("restart-row")).toHaveLength(PANEL_LIMIT);

    fireEvent.click(screen.getByRole("button", { name: `showAll:{"count":${pods.length}}` }));
    expect(screen.queryAllByTestId("restart-row")).toHaveLength(pods.length);

    fireEvent.click(screen.getByRole("button", { name: "showLess" }));
    expect(screen.queryAllByTestId("restart-row")).toHaveLength(PANEL_LIMIT);
  });

  it("offers no show all button below the limit", () => {
    render(<RecentRestartsPanel pods={[pod("demo-web")]} />);

    expect(screen.queryByText(/^showAll/)).not.toBeInTheDocument();
  });
});

describe("RecentWarningsPanel", () => {
  it("shows one row per involved object and opens it on click", () => {
    render(
      <RecentWarningsPanel
        events={[
          event("demo-web"),
          event("demo-web", { reason: "Unhealthy", last_timestamp: minutesAgo(5) }),
        ]}
      />
    );

    expect(screen.queryAllByTestId("warning-row")).toHaveLength(1);
    expect(screen.getByText("Unhealthy")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /demo-web/ }));
    expect(openResourceDetail).toHaveBeenCalledWith("pod", "demo-web", "kubeli-demo");
  });

  it("limits the cluster scope to cluster-level objects", () => {
    render(
      <RecentWarningsPanel
        scope="cluster"
        events={[
          event("demo-web"),
          event("minikube", {
            reason: "NodeNotReady",
            involved_object: { kind: "Node", name: "minikube", namespace: null, uid: null },
          }),
        ]}
      />
    );

    const rows = screen.queryAllByTestId("warning-row");
    expect(rows).toHaveLength(1);
    expect(screen.getByText("NodeNotReady")).toBeInTheDocument();
  });

  it("opens a cluster-scoped object without a namespace", () => {
    render(
      <RecentWarningsPanel
        scope="cluster"
        events={[
          event("minikube", {
            involved_object: { kind: "Node", name: "minikube", namespace: null, uid: null },
          }),
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /minikube/ }));
    expect(openResourceDetail).toHaveBeenCalledWith("node", "minikube", undefined);
  });

  it("shows the empty state when there are no warnings", () => {
    render(<RecentWarningsPanel events={[event("demo-web", { event_type: "Normal" })]} />);

    expect(screen.getByText("noWarnings")).toBeInTheDocument();
  });
});
