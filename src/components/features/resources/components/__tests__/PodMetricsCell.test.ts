import { formatCpuNanoCores } from "../PodMetricsCell";

describe("formatCpuNanoCores", () => {
  it("formats zero CPU", () => {
    expect(formatCpuNanoCores(0)).toBe("0m");
  });

  it("formats sub-millicore values", () => {
    expect(formatCpuNanoCores(500_000)).toBe("0.5m");
  });

  it("formats normal millicore values", () => {
    expect(formatCpuNanoCores(125_000_000)).toBe("125m");
  });

  it("formats full core values", () => {
    expect(formatCpuNanoCores(2_500_000_000)).toBe("2.50");
  });

  it("formats exactly 1 core", () => {
    expect(formatCpuNanoCores(1_000_000_000)).toBe("1.00");
  });

  it("formats fractional millicore", () => {
    expect(formatCpuNanoCores(100_000)).toBe("0.1m");
  });
});
