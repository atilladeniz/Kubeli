import {
  formatCpuNanoCores,
  formatMemoryBytes,
} from "../PodMetricsCell";

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

describe("formatMemoryBytes", () => {
  it("formats zero memory", () => {
    expect(formatMemoryBytes(0)).toBe("0B");
  });

  it("formats kibibytes", () => {
    expect(formatMemoryBytes(1024)).toBe("1Ki");
  });

  it("formats mebibytes", () => {
    expect(formatMemoryBytes(9_718_784)).toBe("9.27Mi");
  });

  it("formats gibibytes", () => {
    expect(formatMemoryBytes(2_684_354_560)).toBe("2.50Gi");
  });

  it("formats small byte values", () => {
    expect(formatMemoryBytes(512)).toBe("512B");
  });

  it("formats large mebibyte values", () => {
    expect(formatMemoryBytes(536_870_912)).toBe("512.00Mi");
  });
});
