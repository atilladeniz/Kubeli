import {
  getErrorMessage,
  isKubeliError,
  toKubeliError,
  type KubeliError,
} from "../errors";

const kubeliError: KubeliError = {
  kind: "Forbidden",
  code: 403,
  message: "Access denied",
  detail: "forbidden",
  resource: "pods/demo",
  suggestions: ["Check RBAC"],
  retryable: false,
};

describe("errors", () => {
  it("recognizes a KubeliError shape", () => {
    expect(isKubeliError(kubeliError)).toBe(true);
    expect(isKubeliError({ message: "missing fields" })).toBe(false);
    expect(isKubeliError(null)).toBe(false);
  });

  it("extracts friendly messages from supported error values", () => {
    expect(getErrorMessage(kubeliError)).toBe("Access denied");
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
    expect(getErrorMessage("plain string")).toBe("plain string");
    expect(getErrorMessage(123)).toBe("An unknown error occurred");
  });

  it("passes through an existing KubeliError", () => {
    expect(toKubeliError(kubeliError)).toBe(kubeliError);
  });

  it("parses a serialized KubeliError JSON string", () => {
    expect(toKubeliError(JSON.stringify(kubeliError))).toEqual(kubeliError);
  });

  it("wraps plain strings, native errors, and unknown values", () => {
    expect(toKubeliError("raw failure")).toEqual({
      kind: "Unknown",
      message: "raw failure",
      suggestions: [],
      retryable: true,
    });

    expect(toKubeliError(new Error("native failure"))).toEqual({
      kind: "Unknown",
      message: "native failure",
      suggestions: [],
      retryable: true,
    });

    expect(toKubeliError({ code: 123 })).toEqual({
      kind: "Unknown",
      message: "[object Object]",
      suggestions: [],
      retryable: true,
    });
  });
});
