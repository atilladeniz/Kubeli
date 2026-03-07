import type { CRDInfo } from "./types";

export const CUSTOM_RESOURCE_PREFIX = "custom-resource";

export interface CustomResourceDefinitionRef {
  group: string;
  version: string;
  kind: string;
  plural: string;
  namespaced: boolean;
}

export type CustomResourceType = `${typeof CUSTOM_RESOURCE_PREFIX}:${string}`;

export interface CustomResourceGroup {
  provider: string;
  resources: Array<{
    id: CustomResourceType;
    label: string;
    definition: CustomResourceDefinitionRef;
  }>;
}

function encodeScope(namespaced: boolean): "ns" | "cluster" {
  return namespaced ? "ns" : "cluster";
}

export function isCustomResourceType(value: string): value is CustomResourceType {
  return value.startsWith(`${CUSTOM_RESOURCE_PREFIX}:`);
}

export function buildCustomResourceType(
  definition: CustomResourceDefinitionRef
): CustomResourceType {
  return [
    CUSTOM_RESOURCE_PREFIX,
    definition.group,
    definition.version,
    definition.kind,
    definition.plural,
    encodeScope(definition.namespaced),
  ].join(":") as CustomResourceType;
}

export function parseCustomResourceType(
  resourceType: string
): CustomResourceDefinitionRef | null {
  if (!isCustomResourceType(resourceType)) {
    return null;
  }

  const [prefix, group, version, kind, plural, scope, ...rest] = resourceType.split(":");
  if (
    prefix !== CUSTOM_RESOURCE_PREFIX ||
    !group ||
    !version ||
    !kind ||
    !plural ||
    (scope !== "ns" && scope !== "cluster") ||
    rest.length > 0
  ) {
    return null;
  }

  return {
    group,
    version,
    kind,
    plural,
    namespaced: scope === "ns",
  };
}

export function getPreferredCRDVersion(crd: CRDInfo): string {
  return (
    crd.versions.find((version) => version.storage)?.name ||
    crd.versions.find((version) => version.served)?.name ||
    crd.versions[0]?.name ||
    "v1"
  );
}

export function toCustomResourceDefinition(crd: CRDInfo): CustomResourceDefinitionRef {
  return {
    group: crd.group,
    version: getPreferredCRDVersion(crd),
    kind: crd.kind,
    plural: crd.plural,
    namespaced: crd.scope.toLowerCase() === "namespaced",
  };
}

export function groupCustomResources(crds: CRDInfo[]): CustomResourceGroup[] {
  const grouped = new Map<string, CustomResourceGroup>();

  crds
    .filter((crd) => crd.conditions_ready)
    .sort((a, b) => {
      const groupCompare = a.group.localeCompare(b.group);
      if (groupCompare !== 0) return groupCompare;
      return a.kind.localeCompare(b.kind);
    })
    .forEach((crd) => {
      const provider = crd.group;
      const definition = toCustomResourceDefinition(crd);
      const entry = grouped.get(provider) ?? {
        provider,
        resources: [],
      };

      entry.resources.push({
        id: buildCustomResourceType(definition),
        label: crd.kind,
        definition,
      });

      grouped.set(provider, entry);
    });

  return Array.from(grouped.values());
}

export function getCustomResourceTabTitle(resourceType: string): string | null {
  const parsed = parseCustomResourceType(resourceType);
  if (!parsed) {
    return null;
  }

  return `Custom Resources - ${parsed.kind}`;
}
