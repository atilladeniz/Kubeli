import { isOperationInProgress } from "../argocd-operation";

describe("isOperationInProgress", () => {
  it("treats Running and Terminating as in progress", () => {
    expect(isOperationInProgress("Running")).toBe(true);
    expect(isOperationInProgress("Terminating")).toBe(true);
  });

  it("treats terminal phases as not in progress", () => {
    expect(isOperationInProgress("Succeeded")).toBe(false);
    expect(isOperationInProgress("Failed")).toBe(false);
    expect(isOperationInProgress("Error")).toBe(false);
  });

  it("treats missing phase as not in progress", () => {
    expect(isOperationInProgress(null)).toBe(false);
    expect(isOperationInProgress(undefined)).toBe(false);
    expect(isOperationInProgress("")).toBe(false);
  });
});
