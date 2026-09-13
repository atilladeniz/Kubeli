import { formatBytes } from "../format-bytes";

describe("formatBytes", () => {
  it.each([
    [0, "0B"],
    [512, "512B"],
    [1023, "1023B"],
    [1024, "1Ki"],
    [1024 ** 2 - 1, "1024Ki"],
    [1024 ** 2, "1.00Mi"],
    [9_718_784, "9.27Mi"],
    [536_870_912, "512.00Mi"],
    [1024 ** 3, "1.00Gi"],
    [2_684_354_560, "2.50Gi"],
    [1024 ** 4, "1.00Ti"],
    [2 * 1024 ** 4, "2.00Ti"],
    [1024 ** 5, "1.00Pi"],
    [3 * 1024 ** 5, "3.00Pi"],
  ])("formats %d bytes as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it("honours the decimals option from Mi upwards", () => {
    expect(formatBytes(2 * 1024 ** 4, 1)).toBe("2.0Ti");
    expect(formatBytes(1536 * 1024, 0)).toBe("2Mi");
    expect(formatBytes(1536, 0)).toBe("2Ki");
  });

  it("does not render terabyte values as four-digit gibibytes", () => {
    expect(formatBytes(2048 * 1024 ** 3)).not.toContain("Gi");
  });
});
