import { filterCustomResourcesByNamespaces } from "../extensions";
import type { CustomResourceInfo } from "@/lib/types";

const resources: CustomResourceInfo[] = [
  {
    name: "a",
    uid: "1",
    namespace: "default",
    kind: "Certificate",
    api_version: "cert-manager.io/v1",
    status: "Ready",
    created_at: "2026-03-07T00:00:00Z",
    labels: {},
  },
  {
    name: "b",
    uid: "2",
    namespace: "kube-system",
    kind: "Certificate",
    api_version: "cert-manager.io/v1",
    status: null,
    created_at: "2026-03-07T00:00:00Z",
    labels: {},
  },
  {
    name: "c",
    uid: "3",
    namespace: null,
    kind: "ClusterIssuer",
    api_version: "cert-manager.io/v1",
    status: null,
    created_at: "2026-03-07T00:00:00Z",
    labels: {},
  },
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
});
