import { render, screen } from "@testing-library/react";
import {
  NodeAllocationCell,
  nodeAllocation,
  formatMilliCores,
  formatBytes,
} from "../NodeAllocationCell";
import type { NodeInfo } from "@/lib/types";

const node = (overrides: Partial<NodeInfo> = {}): NodeInfo => ({
  name: "minikube",
  uid: "node-1",
  status: "Ready",
  unschedulable: false,
  roles: ["control-plane"],
  version: "v1.31.0",
  os_image: null,
  kernel_version: null,
  container_runtime: null,
  cpu_capacity: "8",
  memory_capacity: "16Gi",
  pod_capacity: "110",
  created_at: null,
  labels: {},
  internal_ip: "192.168.49.2",
  external_ip: null,
  pods_scheduled: 18,
  pods_allocatable: 110,
  cpu_requests_milli: 3150,
  cpu_allocatable_milli: 8000,
  memory_requests_bytes: 4 * 1024 ** 3,
  memory_allocatable_bytes: 16 * 1024 ** 3,
  ...overrides,
});

const bar = (container: HTMLElement) =>
  container.querySelector("[data-testid] > div:last-child > div") as HTMLElement;

describe("formatMilliCores", () => {
  it("switches to whole cores at 1000m", () => {
    expect(formatMilliCores(750)).toBe("750m");
    expect(formatMilliCores(1000)).toBe("1");
    expect(formatMilliCores(3150)).toBe("3.15");
    expect(formatMilliCores(0)).toBe("0m");
  });
});

describe("formatBytes", () => {
  it("uses binary units", () => {
    expect(formatBytes(512)).toBe("512B");
    expect(formatBytes(4 * 1024 ** 2)).toBe("4Mi");
    expect(formatBytes(4 * 1024 ** 3)).toBe("4.0Gi");
    expect(formatBytes(2 * 1024 ** 4)).toBe("2.00Ti");
  });
});

describe("nodeAllocation", () => {
  it("reads the used/allocatable pair per kind", () => {
    expect(nodeAllocation(node(), "pods")).toMatchObject({
      used: 18,
      total: 110,
      label: "18 / 110",
    });
    expect(nodeAllocation(node(), "cpu")).toMatchObject({
      used: 3150,
      total: 8000,
      label: "3.15 / 8",
    });
    expect(nodeAllocation(node(), "memory")).toMatchObject({
      used: 4 * 1024 ** 3,
      total: 16 * 1024 ** 3,
      label: "4.0Gi / 16.0Gi",
    });
  });

  it("shows a question mark when the node reported no pod allocatable", () => {
    expect(nodeAllocation(node({ pods_allocatable: null }), "pods").label).toBe("18 / ?");
  });
});

describe("NodeAllocationCell", () => {
  it("renders the ratio, the percentage and a bar", () => {
    const { container } = render(<NodeAllocationCell node={node()} kind="cpu" />);

    expect(screen.getByText("3.15 / 8")).toBeInTheDocument();
    expect(screen.getByText("39%")).toBeInTheDocument();
    expect(bar(container).style.width).toBe("39.375%");
    expect(bar(container).className).toContain("bg-blue-500");
  });

  it("turns yellow above 75% and red above 90%", () => {
    const { container: warn } = render(
      <NodeAllocationCell node={node({ cpu_requests_milli: 6400 })} kind="cpu" />
    );
    expect(bar(warn).className).toContain("bg-yellow-500");

    const { container: crit } = render(
      <NodeAllocationCell node={node({ cpu_requests_milli: 7600 })} kind="cpu" />
    );
    expect(bar(crit).className).toContain("bg-destructive");
  });

  it("caps the bar at 100% when requests exceed allocatable", () => {
    const { container } = render(
      <NodeAllocationCell node={node({ cpu_requests_milli: 12000 })} kind="cpu" />
    );

    expect(screen.getByText("150%")).toBeInTheDocument();
    expect(bar(container).style.width).toBe("100%");
  });

  it("renders a dash instead of a bar when allocatable is unknown", () => {
    render(<NodeAllocationCell node={node({ cpu_allocatable_milli: 0 })} kind="cpu" />);

    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.queryByTestId("node-cpu")).not.toBeInTheDocument();
  });
});
