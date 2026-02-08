import type { StatusBadgeTone } from "./statusBadgeStyles";

export type BadgeNamespace = "common" | "workloads" | "storage" | "helm";

export interface BadgeNamespaceKeys {
  common:
    | "active"
    | "aggregated"
    | "attached"
    | "default"
    | "established"
    | "fail"
    | "ignore"
    | "namespaced"
    | "no"
    | "notReady"
    | "reconciling"
    | "ready"
    | "terminating"
    | "unknown"
    | "yes";
  workloads:
    | "active"
    | "complete"
    | "failed"
    | "pending"
    | "running"
    | "succeeded"
    | "suspended";
  storage: "attached" | "available" | "bound" | "lost" | "released";
  helm:
    | "deployed"
    | "failed"
    | "pendingInstall"
    | "pendingRollback"
    | "pendingUpgrade"
    | "superseded"
    | "uninstalled"
    | "uninstalling";
}

export type BadgeLabelRef<N extends BadgeNamespace = BadgeNamespace> = {
  namespace: N;
  key: BadgeNamespaceKeys[N];
};

type BadgeTranslatorMap<N extends BadgeNamespace> = {
  [K in N]: (key: BadgeNamespaceKeys[K]) => string;
};

export function resolveBadgeLabel<N extends BadgeNamespace>(
  label: BadgeLabelRef<N>,
  translators: BadgeTranslatorMap<N>
): string {
  return translators[label.namespace](label.key);
}

export interface StatusBadgeConfig<N extends BadgeNamespace = BadgeNamespace> {
  tone: StatusBadgeTone;
  label: BadgeLabelRef<N>;
}

export function getStatusBadgeConfig<T extends Record<string, StatusBadgeConfig>>(
  config: T,
  key: string
): T[keyof T] | undefined {
  return config[key as keyof T];
}

export function getLabelRef<T extends Record<string, BadgeLabelRef>>(
  labels: T,
  key: string
): T[keyof T] | undefined {
  return labels[key as keyof T];
}

export const booleanBadgeVariants = {
  yesNo: {
    trueLabel: { namespace: "common", key: "yes" },
    falseLabel: { namespace: "common", key: "no" },
    trueTone: "success",
    falseTone: "neutral",
  },
  activeSuspended: {
    trueLabel: { namespace: "workloads", key: "suspended" },
    falseLabel: { namespace: "workloads", key: "active" },
    trueTone: "warning",
    falseTone: "success",
  },
  establishedPending: {
    trueLabel: { namespace: "common", key: "established" },
    falseLabel: { namespace: "workloads", key: "pending" },
    trueTone: "success",
    falseTone: "warning",
  },
} as const satisfies Record<
  string,
  {
    trueLabel: BadgeLabelRef;
    falseLabel: BadgeLabelRef;
    trueTone: StatusBadgeTone;
    falseTone: StatusBadgeTone;
  }
>;

export type BooleanBadgeVariant = keyof typeof booleanBadgeVariants;

export const jobStatusConfig = {
  Complete: { tone: "success", label: { namespace: "workloads", key: "complete" } },
  Running: { tone: "info", label: { namespace: "workloads", key: "running" } },
  Failed: { tone: "danger", label: { namespace: "workloads", key: "failed" } },
  Pending: { tone: "warning", label: { namespace: "workloads", key: "pending" } },
} as const satisfies Record<string, StatusBadgeConfig>;

export const fluxStatusConfig = {
  ready: { tone: "success", label: { namespace: "common", key: "ready" } },
  notready: { tone: "warning", label: { namespace: "common", key: "notReady" } },
  reconciling: { tone: "info", label: { namespace: "common", key: "reconciling" } },
  failed: { tone: "danger", label: { namespace: "workloads", key: "failed" } },
  unknown: { tone: "neutral", label: { namespace: "common", key: "unknown" } },
} as const satisfies Record<string, StatusBadgeConfig>;

export const helmStatusConfig = {
  deployed: { tone: "success", label: { namespace: "helm", key: "deployed" } },
  superseded: { tone: "neutral", label: { namespace: "helm", key: "superseded" } },
  failed: { tone: "danger", label: { namespace: "helm", key: "failed" } },
  uninstalling: { tone: "warning", label: { namespace: "helm", key: "uninstalling" } },
  "pending-install": { tone: "info", label: { namespace: "helm", key: "pendingInstall" } },
  "pending-upgrade": { tone: "info", label: { namespace: "helm", key: "pendingUpgrade" } },
  "pending-rollback": { tone: "warning", label: { namespace: "helm", key: "pendingRollback" } },
  uninstalled: { tone: "neutral", label: { namespace: "helm", key: "uninstalled" } },
} as const satisfies Record<string, StatusBadgeConfig>;

export const nodeStatusConfig = {
  Ready: { tone: "success", label: { namespace: "common", key: "ready" } },
  NotReady: { tone: "warning", label: { namespace: "common", key: "notReady" } },
  Unknown: { tone: "warning", label: { namespace: "common", key: "unknown" } },
} as const satisfies Record<string, StatusBadgeConfig>;

export const namespaceStatusConfig = {
  Active: { tone: "success", label: { namespace: "common", key: "active" } },
  Terminating: { tone: "warning", label: { namespace: "common", key: "terminating" } },
  Unknown: { tone: "warning", label: { namespace: "common", key: "unknown" } },
} as const satisfies Record<string, StatusBadgeConfig>;

export const pvStatusConfig = {
  Available: { tone: "success", label: { namespace: "storage", key: "available" } },
  Bound: { tone: "info", label: { namespace: "storage", key: "bound" } },
  Released: { tone: "warning", label: { namespace: "storage", key: "released" } },
  Failed: { tone: "danger", label: { namespace: "workloads", key: "failed" } },
  Pending: { tone: "warning", label: { namespace: "workloads", key: "pending" } },
} as const satisfies Record<string, StatusBadgeConfig>;

export const pvcStatusConfig = {
  Bound: { tone: "success", label: { namespace: "storage", key: "bound" } },
  Pending: { tone: "warning", label: { namespace: "workloads", key: "pending" } },
  Lost: { tone: "danger", label: { namespace: "storage", key: "lost" } },
} as const satisfies Record<string, StatusBadgeConfig>;

export const failurePolicyConfig = {
  Fail: { tone: "danger", label: { namespace: "common", key: "fail" } },
  Ignore: { tone: "neutral", label: { namespace: "common", key: "ignore" } },
} as const satisfies Record<string, StatusBadgeConfig>;

export const crdScopeLabels = {
  Namespaced: { namespace: "common", key: "namespaced" },
} as const satisfies Record<string, BadgeLabelRef>;
