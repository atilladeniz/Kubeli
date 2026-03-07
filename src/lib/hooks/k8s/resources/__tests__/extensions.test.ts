import { filterCustomResourcesByNamespaces } from "../extensions";
import type { CustomResourceInfo } from "@/lib/types";

function createResource(
  overrides: Partial<CustomResourceInfo> = {}
): CustomResourceInfo {
  return {
    name: "resource",
    uid: "uid-1",
    namespace: "default",
    kind: "Certificate",
    api_version: "cert-manager.io/v1",
    status: "Ready",
    created_at: "2026-03-07T00:00:00Z",
    labels: {},
    ...overrides,
  };
}

const resources: CustomResourceInfo[] = [
  createResource({ name: "a", uid: "1", namespace: "default" }),
  createResource({ name: "b", uid: "2", namespace: "kube-system", status: null }),
  createResource({
    name: "c",
    uid: "3",
    namespace: null,
    kind: "ClusterIssuer",
    status: null,
  }),
];

describe("filterCustomResourcesByNamespaces", () => {
  it("returns all resources when no namespace filter is provided", () => {
    expect(filterCustomResourcesByNamespaces(resources, [])).toEqual(resources);
  });

  it("keeps only resources that belong to the selected namespaces", () => {
    expect(filterCustomResourcesByNamespaces(resources, ["default"])).toEqual([
      resources[0],
    ]);
  });

  it("filters by multiple namespaces", () => {
    const result = filterCustomResourcesByNamespaces(resources, [
      "default",
      "kube-system",
    ]);
    expect(result).toEqual([resources[0], resources[1]]);
  });

  it("excludes cluster-scoped resources (namespace: null) when filtering", () => {
    const result = filterCustomResourcesByNamespaces(resources, [
      "default",
      "kube-system",
    ]);
    expect(result.find((r) => r.name === "c")).toBeUndefined();
  });

  it("returns empty array when no resources match the filter", () => {
    expect(
      filterCustomResourcesByNamespaces(resources, ["nonexistent"])
    ).toEqual([]);
  });

  it("handles empty resources array", () => {
    expect(filterCustomResourcesByNamespaces([], ["default"])).toEqual([]);
  });
});
