import type {
  HPAInfo,
  LimitRangeInfo,
  ResourceQuotaInfo,
  PDBInfo,
} from "@/lib/types";
import type { Column } from "../types";
import { NamespaceColorDot } from "../components/NamespaceColorDot";
import { formatAge } from "../lib/utils";

/**
 * Highest current utilization across an HPA's metrics, in percent.
 *
 * An HPA scales on whichever metric is most under pressure, so the maximum is
 * what decides its behaviour. Returns null when no metric reports a percentage
 * — value-based metrics (e.g. requests-per-second) have no utilization ratio.
 */
function peakUtilization(hpa: HPAInfo): number | null {
  const percentages = hpa.current_metrics
    .map((m) => m.current_average_utilization)
    .filter((v): v is number => v !== null && v !== undefined);
  return percentages.length > 0 ? Math.max(...percentages) : null;
}

/** Target utilization matching the peak metric, for the "of X%" suffix */
function targetUtilization(hpa: HPAInfo): number | null {
  const targets = hpa.metrics
    .map((m) => m.average_utilization)
    .filter((v): v is number => v !== null && v !== undefined);
  return targets.length > 0 ? Math.max(...targets) : null;
}

function utilizationColor(current: number, target: number | null): string {
  // Relative to target when there is one: 90% CPU against a 95% target is
  // healthy, against a 50% target it is not.
  const ratio = target ? (current / target) * 100 : current;
  if (ratio >= 100) return "text-red-500";
  if (ratio >= 80) return "text-yellow-500";
  return "text-green-500";
}

export const hpaColumns: Column<HPAInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (hpa) => <span className="font-medium">{hpa.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (hpa) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={hpa.namespace} />
        <span>{hpa.namespace}</span>
      </div>
    ),
  },
  {
    key: "reference",
    label: "REFERENCE",
    sortable: true,
    render: (hpa) => `${hpa.scale_target_ref_kind}/${hpa.scale_target_ref_name}`,
  },
  {
    key: "min_replicas",
    label: "MIN",
    sortable: true,
    render: (hpa) => hpa.min_replicas ?? "-",
  },
  {
    key: "max_replicas",
    label: "MAX",
    sortable: true,
    render: (hpa) => hpa.max_replicas,
  },
  {
    key: "replicas",
    label: "REPLICAS",
    sortable: true,
    render: (hpa) => `${hpa.current_replicas}/${hpa.desired_replicas}`,
  },
  {
    key: "utilization",
    label: "UTILIZATION",
    sortable: true,
    width: "w-32",
    noTruncate: true,
    sortValue: peakUtilization,
    render: (hpa) => {
      const current = peakUtilization(hpa);
      if (current === null) return <span className="text-muted-foreground">-</span>;

      const target = targetUtilization(hpa);
      return (
        <span className="tabular-nums">
          <span className={`font-medium ${utilizationColor(current, target)}`}>
            {current}%
          </span>
          {target !== null && (
            <span className="text-muted-foreground"> / {target}%</span>
          )}
        </span>
      );
    },
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (hpa) => (hpa.created_at ? formatAge(hpa.created_at) : "-"),
  },
];

export const limitRangeColumns: Column<LimitRangeInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (lr) => <span className="font-medium">{lr.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (lr) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={lr.namespace} />
        <span>{lr.namespace}</span>
      </div>
    ),
  },
  {
    key: "limits_count",
    label: "LIMITS",
    sortable: false,
    render: (lr) => lr.limits.length,
  },
  {
    key: "types",
    label: "TYPES",
    sortable: false,
    render: (lr) => lr.limits.map((l) => l.type).join(", ") || "-",
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (lr) => (lr.created_at ? formatAge(lr.created_at) : "-"),
  },
];

export const resourceQuotaColumns: Column<ResourceQuotaInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (rq) => <span className="font-medium">{rq.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (rq) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={rq.namespace} />
        <span>{rq.namespace}</span>
      </div>
    ),
  },
  {
    key: "resources",
    label: "RESOURCES",
    sortable: false,
    getSearchText: (rq) =>
      Object.entries(rq.hard)
        .map(([k, v]) => `${k}=${v}`)
        .join(", "),
    render: (rq) => Object.keys(rq.hard).length,
  },
  {
    key: "scopes",
    label: "SCOPES",
    sortable: false,
    render: (rq) => rq.scopes.join(", ") || "-",
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (rq) => (rq.created_at ? formatAge(rq.created_at) : "-"),
  },
];

export const pdbColumns: Column<PDBInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (pdb) => <span className="font-medium">{pdb.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (pdb) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={pdb.namespace} />
        <span>{pdb.namespace}</span>
      </div>
    ),
  },
  {
    key: "min_available",
    label: "MIN AVAILABLE",
    sortable: false,
    render: (pdb) => pdb.min_available || "-",
  },
  {
    key: "max_unavailable",
    label: "MAX UNAVAILABLE",
    sortable: false,
    render: (pdb) => pdb.max_unavailable || "-",
  },
  {
    key: "allowed_disruptions",
    label: "ALLOWED",
    sortable: true,
    render: (pdb) => pdb.disruptions_allowed,
  },
  {
    key: "pods",
    label: "PODS",
    sortable: false,
    render: (pdb) => `${pdb.current_healthy}/${pdb.expected_pods}`,
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (pdb) => (pdb.created_at ? formatAge(pdb.created_at) : "-"),
  },
];
