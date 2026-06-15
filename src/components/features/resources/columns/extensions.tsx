import type {
  HelmReleaseInfo,
  FluxKustomizationInfo,
  ArgoCDApplicationInfo,
} from "@/lib/types";
import type { Column, TranslateFunc } from "../types";
import { NamespaceColorDot } from "../components/NamespaceColorDot";
import { HelmStatusBadge } from "../components/badges/HelmStatusBadge";
import { FluxKustomizationStatusBadge } from "../components/badges/FluxKustomizationStatusBadge";
import { ArgoCDSyncStatusBadge } from "../components/badges/ArgoCDSyncStatusBadge";
import { ArgoCDHealthStatusBadge } from "../components/badges/ArgoCDHealthStatusBadge";
import { formatAge } from "../lib/utils";

export const helmReleaseColumns: Column<HelmReleaseInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (r) => (
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-xs">{r.name}</span>
        {r.managed_by === "flux" && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/10 text-purple-500 border border-purple-500/20">
            Flux
          </span>
        )}
      </div>
    ),
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (r) => (
      <div className="flex items-center gap-1.5">
        <NamespaceColorDot namespace={r.namespace} />
        <span className="text-muted-foreground text-xs">{r.namespace}</span>
      </div>
    ),
  },
  {
    key: "status",
    label: "STATUS",
    sortable: true,
    render: (r) => <HelmStatusBadge status={r.status} />,
  },
  {
    key: "chart",
    label: "CHART",
    sortable: true,
    render: (r) => (
      <span className="text-xs text-muted-foreground">
        {r.chart}-{r.chart_version}
      </span>
    ),
  },
  {
    key: "app_version",
    label: "APP VERSION",
    sortable: true,
    render: (r) => (
      <span className="text-xs text-muted-foreground">{r.app_version || "-"}</span>
    ),
  },
  {
    key: "revision",
    label: "REVISION",
    sortable: true,
    render: (r) => r.revision,
  },
  {
    key: "last_deployed",
    label: "UPDATED",
    sortable: true,
    render: (r) => (r.last_deployed ? formatAge(r.last_deployed) : "-"),
  },
];

export function getHelmReleaseColumns(t: TranslateFunc): Column<HelmReleaseInfo>[] {
  return [
    {
      key: "name",
      label: t("columns.name"),
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-xs">{r.name}</span>
          {r.managed_by === "flux" && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/10 text-purple-500 border border-purple-500/20">
              Flux
            </span>
          )}
        </div>
      ),
    },
    {
      key: "namespace",
      label: t("columns.namespace"),
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <NamespaceColorDot namespace={r.namespace} />
          <span className="text-muted-foreground text-xs">{r.namespace}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: t("columns.status"),
      sortable: true,
      render: (r) => <HelmStatusBadge status={r.status} />,
    },
    {
      key: "chart",
      label: t("columns.chart"),
      sortable: true,
      render: (r) => (
        <span className="text-xs text-muted-foreground">{r.chart}-{r.chart_version}</span>
      ),
    },
    {
      key: "app_version",
      label: t("columns.appVersion"),
      sortable: true,
      render: (r) => <span className="text-xs text-muted-foreground">{r.app_version || "-"}</span>,
    },
    {
      key: "revision",
      label: t("columns.revision"),
      sortable: true,
      render: (r) => r.revision,
    },
    {
      key: "last_deployed",
      label: t("columns.updated"),
      sortable: true,
      render: (r) => (r.last_deployed ? formatAge(r.last_deployed) : "-"),
    },
  ];
}

export const fluxKustomizationColumns: Column<FluxKustomizationInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (k) => <span className="font-medium text-xs">{k.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (k) => (
      <div className="flex items-center gap-1.5">
        <NamespaceColorDot namespace={k.namespace} />
        <span className="text-muted-foreground text-xs">{k.namespace}</span>
      </div>
    ),
  },
  {
    key: "status",
    label: "STATUS",
    sortable: true,
    render: (k) => <FluxKustomizationStatusBadge status={k.status} />,
  },
  {
    key: "path",
    label: "PATH",
    sortable: true,
    render: (k) => (
      <span className="text-xs text-muted-foreground font-mono">{k.path || "-"}</span>
    ),
  },
  {
    key: "source_ref",
    label: "SOURCE",
    sortable: true,
    render: (k) => (
      <span className="text-xs text-muted-foreground">{k.source_ref || "-"}</span>
    ),
  },
  {
    key: "interval",
    label: "INTERVAL",
    sortable: true,
    render: (k) => (
      <span className="text-xs text-muted-foreground">{k.interval || "-"}</span>
    ),
  },
  {
    key: "last_applied_revision",
    label: "REVISION",
    sortable: false,
    render: (k) => (
      <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px] block">
        {k.last_applied_revision ? k.last_applied_revision.slice(0, 12) : "-"}
      </span>
    ),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (k) => (k.created_at ? formatAge(k.created_at) : "-"),
  },
];

export const argoCDApplicationColumns: Column<ArgoCDApplicationInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (a) => <span className="font-medium text-xs">{a.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (a) => (
      <div className="flex items-center gap-1.5">
        <NamespaceColorDot namespace={a.namespace} />
        <span className="text-muted-foreground text-xs">{a.namespace}</span>
      </div>
    ),
  },
  {
    key: "project",
    label: "PROJECT",
    sortable: true,
    render: (a) => (
      <span className="text-xs text-muted-foreground">{a.project || "-"}</span>
    ),
  },
  {
    key: "sync_status",
    label: "SYNC",
    sortable: true,
    render: (a) => <ArgoCDSyncStatusBadge status={a.sync_status} />,
  },
  {
    key: "health_status",
    label: "HEALTH",
    sortable: true,
    render: (a) => <ArgoCDHealthStatusBadge status={a.health_status} />,
  },
  {
    key: "repo_url",
    label: "REPO",
    sortable: true,
    render: (a) => (
      <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
        {a.repo_url || "-"}
      </span>
    ),
  },
  {
    key: "path",
    label: "PATH",
    sortable: true,
    render: (a) => (
      <span className="text-xs text-muted-foreground font-mono">{a.path || "-"}</span>
    ),
  },
  {
    key: "current_revision",
    label: "REVISION",
    sortable: false,
    render: (a) => (
      <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px] block">
        {a.current_revision ? a.current_revision.slice(0, 12) : "-"}
      </span>
    ),
  },
  {
    key: "dest_namespace",
    label: "DEST",
    sortable: true,
    render: (a) => (
      <span className="text-xs text-muted-foreground">{a.dest_namespace || "-"}</span>
    ),
  },
  {
    key: "sync_policy",
    label: "SYNC POLICY",
    sortable: true,
    render: (a) => (
      <span className="text-xs text-muted-foreground capitalize">{a.sync_policy}</span>
    ),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (a) => (a.created_at ? formatAge(a.created_at) : "-"),
  },
];
