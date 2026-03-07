import {
  buildCustomResourceType,
  getCustomResourceTabTitle,
  getPreferredCRDVersion,
  groupCustomResources,
  isCustomResourceType,
  parseCustomResourceType,
} from "../custom-resources";
import type { CRDInfo } from "../types";

function createCRD(overrides: Partial<CRDInfo> = {}): CRDInfo {
  return {
    name: "certificates.cert-manager.io",
    uid: "crd-1",
    group: "cert-manager.io",
    scope: "Namespaced",
    kind: "Certificate",
    singular: "certificate",
    plural: "certificates",
    short_names: [],
    versions: [
      { name: "v1", served: true, storage: true },
      { name: "v1beta1", served: true, storage: false },
    ],
    stored_versions: ["v1"],
    conditions_ready: true,
    created_at: "2026-03-07T00:00:00Z",
    labels: {},
    ...overrides,
  };
}

describe("custom resource helpers", () => {
  describe("buildCustomResourceType / parseCustomResourceType", () => {
    it("builds and parses namespaced resource ids", () => {
      const resourceType = buildCustomResourceType({
        group: "cert-manager.io",
        version: "v1",
        kind: "Certificate",
        plural: "certificates",
        namespaced: true,
      });

      expect(resourceType).toBe(
        "custom-resource:cert-manager.io:v1:Certificate:certificates:ns"
      );
      expect(parseCustomResourceType(resourceType)).toEqual({
        group: "cert-manager.io",
        version: "v1",
        kind: "Certificate",
        plural: "certificates",
        namespaced: true,
      });
    });

    it("builds and parses cluster-scoped resource ids", () => {
      const resourceType = buildCustomResourceType({
        group: "cert-manager.io",
        version: "v1",
        kind: "ClusterIssuer",
        plural: "clusterissuers",
        namespaced: false,
      });

      expect(resourceType).toBe(
        "custom-resource:cert-manager.io:v1:ClusterIssuer:clusterissuers:cluster"
      );
      expect(parseCustomResourceType(resourceType)).toEqual({
        group: "cert-manager.io",
        version: "v1",
        kind: "ClusterIssuer",
        plural: "clusterissuers",
        namespaced: false,
      });
    });

    it("returns null for non-custom-resource strings", () => {
      expect(parseCustomResourceType("pods")).toBeNull();
      expect(parseCustomResourceType("")).toBeNull();
      expect(parseCustomResourceType("custom-resource:")).toBeNull();
    });

    it("returns null for malformed custom resource strings", () => {
      expect(parseCustomResourceType("custom-resource:group:v1")).toBeNull();
      expect(
        parseCustomResourceType("custom-resource:g:v:k:p:invalid")
      ).toBeNull();
      // Extra segments
      expect(
        parseCustomResourceType("custom-resource:g:v:k:p:ns:extra")
      ).toBeNull();
    });
  });

  describe("isCustomResourceType", () => {
    it("detects custom resource type strings", () => {
      expect(
        isCustomResourceType(
          "custom-resource:cert-manager.io:v1:Certificate:certificates:ns"
        )
      ).toBe(true);
    });

    it("rejects non-custom-resource strings", () => {
      expect(isCustomResourceType("pods")).toBe(false);
      expect(isCustomResourceType("deployments")).toBe(false);
      expect(isCustomResourceType("")).toBe(false);
    });
  });

  describe("getPreferredCRDVersion", () => {
    it("prefers storage version", () => {
      expect(getPreferredCRDVersion(createCRD())).toBe("v1");
    });

    it("falls back to first served version when no storage version", () => {
      expect(
        getPreferredCRDVersion(
          createCRD({
            versions: [
              { name: "v1alpha1", served: true, storage: false },
              { name: "v1beta1", served: false, storage: false },
            ],
          })
        )
      ).toBe("v1alpha1");
    });

    it("falls back to first version when none served or stored", () => {
      expect(
        getPreferredCRDVersion(
          createCRD({
            versions: [
              { name: "v2", served: false, storage: false },
              { name: "v1", served: false, storage: false },
            ],
          })
        )
      ).toBe("v2");
    });

    it("returns v1 for empty versions array", () => {
      expect(getPreferredCRDVersion(createCRD({ versions: [] }))).toBe("v1");
    });
  });

  describe("groupCustomResources", () => {
    it("groups ready CRDs by provider and sorts their kinds", () => {
      const groups = groupCustomResources([
        createCRD({
          kind: "Issuer",
          name: "issuers.cert-manager.io",
          plural: "issuers",
        }),
        createCRD(),
        createCRD({
          group: "traefik.io",
          kind: "IngressRoute",
          name: "ingressroutes.traefik.io",
          plural: "ingressroutes",
        }),
        createCRD({
          kind: "Challenge",
          name: "challenges.acme.cert-manager.io",
          plural: "challenges",
          conditions_ready: false,
        }),
      ]);

      expect(groups).toEqual([
        {
          provider: "cert-manager.io",
          resources: [
            {
              id: "custom-resource:cert-manager.io:v1:Certificate:certificates:ns",
              label: "Certificate",
              definition: {
                group: "cert-manager.io",
                version: "v1",
                kind: "Certificate",
                plural: "certificates",
                namespaced: true,
              },
            },
            {
              id: "custom-resource:cert-manager.io:v1:Issuer:issuers:ns",
              label: "Issuer",
              definition: {
                group: "cert-manager.io",
                version: "v1",
                kind: "Issuer",
                plural: "issuers",
                namespaced: true,
              },
            },
          ],
        },
        {
          provider: "traefik.io",
          resources: [
            {
              id: "custom-resource:traefik.io:v1:IngressRoute:ingressroutes:ns",
              label: "IngressRoute",
              definition: {
                group: "traefik.io",
                version: "v1",
                kind: "IngressRoute",
                plural: "ingressroutes",
                namespaced: true,
              },
            },
          ],
        },
      ]);
    });

    it("returns empty array for empty input", () => {
      expect(groupCustomResources([])).toEqual([]);
    });

    it("excludes CRDs that are not ready", () => {
      const groups = groupCustomResources([
        createCRD({ conditions_ready: false }),
      ]);
      expect(groups).toEqual([]);
    });

    it("sorts providers alphabetically", () => {
      const groups = groupCustomResources([
        createCRD({
          group: "z-provider.io",
          kind: "ZResource",
          name: "zresources.z-provider.io",
          plural: "zresources",
        }),
        createCRD({
          group: "a-provider.io",
          kind: "AResource",
          name: "aresources.a-provider.io",
          plural: "aresources",
        }),
      ]);

      expect(groups.map((g) => g.provider)).toEqual([
        "a-provider.io",
        "z-provider.io",
      ]);
    });

    it("sorts kinds alphabetically within a provider", () => {
      const groups = groupCustomResources([
        createCRD({ kind: "Zebra", plural: "zebras" }),
        createCRD({ kind: "Alpha", plural: "alphas" }),
        createCRD({ kind: "Middle", plural: "middles" }),
      ]);

      expect(groups[0].resources.map((r) => r.label)).toEqual([
        "Alpha",
        "Middle",
        "Zebra",
      ]);
    });
  });

  describe("getCustomResourceTabTitle", () => {
    it("formats custom resource tab titles", () => {
      expect(
        getCustomResourceTabTitle(
          "custom-resource:cert-manager.io:v1:Certificate:certificates:ns"
        )
      ).toBe("Custom Resources - Certificate");
    });

    it("returns null for non-custom-resource strings", () => {
      expect(getCustomResourceTabTitle("pods")).toBeNull();
    });
  });
});
