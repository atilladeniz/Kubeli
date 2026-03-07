import {
  buildCustomResourceType,
  getCustomResourceTabTitle,
  groupCustomResources,
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
  it("builds and parses custom resource ids", () => {
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

  it("formats custom resource tab titles", () => {
    expect(
      getCustomResourceTabTitle(
        "custom-resource:cert-manager.io:v1:Certificate:certificates:ns"
      )
    ).toBe("Custom Resources - Certificate");
  });
});
