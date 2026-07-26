import { render } from "@testing-library/react";
import { hpaColumns } from "../scaling";
import type { HPAInfo, HPAMetricStatus, HPAMetricTarget } from "@/lib/types";

const currentMetric = (
  utilization: number | null,
  type = "Resource"
): HPAMetricStatus => ({
  type,
  current_average_utilization: utilization,
  current_average_value: null,
  current_value: null,
});

const targetMetric = (utilization: number | null, type = "Resource"): HPAMetricTarget => ({
  type,
  average_utilization: utilization,
  average_value: null,
  value: null,
});

const hpa = (overrides: Partial<HPAInfo> = {}): HPAInfo => ({
  name: "demo-web-hpa",
  namespace: "default",
  uid: "uid-1",
  scale_target_ref_kind: "Deployment",
  scale_target_ref_name: "demo-web",
  min_replicas: 1,
  max_replicas: 10,
  current_replicas: 3,
  desired_replicas: 3,
  metrics: [targetMetric(80)],
  current_metrics: [currentMetric(45)],
  conditions: [],
  created_at: "2024-01-01T10:00:00Z",
  labels: {},
  ...overrides,
});

const utilizationColumn = hpaColumns.find((c) => c.key === "utilization")!;

const renderCell = (info: HPAInfo) =>
  render(<>{utilizationColumn.render!(info)}</>);

describe("HPA utilization column", () => {
  it("is sortable and supplies its own sort value", () => {
    expect(utilizationColumn.sortable).toBe(true);
    expect(typeof utilizationColumn.sortValue).toBe("function");
  });

  it("shows current and target utilization", () => {
    const { container } = renderCell(hpa());
    expect(container.textContent).toBe("45% / 80%");
  });

  it("omits the target when the HPA has no percentage target", () => {
    const { container } = renderCell(hpa({ metrics: [targetMetric(null)] }));
    expect(container.textContent).toBe("45%");
  });

  it("renders a dash when no metric reports a percentage", () => {
    // Value-based metrics (e.g. requests-per-second) have no utilization ratio
    const { container } = renderCell(
      hpa({ current_metrics: [currentMetric(null, "Pods")] })
    );
    expect(container.textContent).toBe("-");
  });

  it("renders a dash when metrics are not yet available", () => {
    const { container } = renderCell(hpa({ current_metrics: [] }));
    expect(container.textContent).toBe("-");
  });

  describe("sort value", () => {
    const sortValue = (info: HPAInfo) => utilizationColumn.sortValue!(info);

    it("reports the current utilization", () => {
      expect(sortValue(hpa())).toBe(45);
    });

    // An HPA scales on whichever metric is most under pressure
    it("reports the peak across multiple metrics", () => {
      expect(
        sortValue(hpa({ current_metrics: [currentMetric(30), currentMetric(92)] }))
      ).toBe(92);
    });

    it("returns null when no metric reports a percentage", () => {
      expect(sortValue(hpa({ current_metrics: [] }))).toBeNull();
      expect(sortValue(hpa({ current_metrics: [currentMetric(null)] }))).toBeNull();
    });

    it("sorts numerically, not lexically", () => {
      const values = [hpa({ current_metrics: [currentMetric(9)] }), hpa()]
        .map(sortValue)
        .sort((a, b) => (a as number) - (b as number));
      // Lexical ordering would put "45" before "9"
      expect(values).toEqual([9, 45]);
    });
  });

  describe("color thresholds", () => {
    const colorOf = (info: HPAInfo) =>
      renderCell(info).container.querySelector("span span")?.className ?? "";

    // Coloring is relative to the target: 90% against a 95% target is fine
    it("is green well below target", () => {
      expect(colorOf(hpa({ current_metrics: [currentMetric(40)] }))).toContain(
        "text-green-500"
      );
    });

    it("is yellow when approaching target", () => {
      expect(colorOf(hpa({ current_metrics: [currentMetric(70)] }))).toContain(
        "text-yellow-500"
      );
    });

    it("is red at or above target", () => {
      expect(colorOf(hpa({ current_metrics: [currentMetric(85)] }))).toContain(
        "text-red-500"
      );
    });

    it("falls back to absolute thresholds without a target", () => {
      const noTarget = { metrics: [targetMetric(null)] };
      expect(
        colorOf(hpa({ ...noTarget, current_metrics: [currentMetric(40)] }))
      ).toContain("text-green-500");
      expect(
        colorOf(hpa({ ...noTarget, current_metrics: [currentMetric(85)] }))
      ).toContain("text-yellow-500");
      expect(
        colorOf(hpa({ ...noTarget, current_metrics: [currentMetric(105)] }))
      ).toContain("text-red-500");
    });
  });
});
