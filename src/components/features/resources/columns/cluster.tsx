import type {
  NodeInfo,
  CRDInfo,
  PriorityClassInfo,
  RuntimeClassInfo,
  MutatingWebhookInfo,
  ValidatingWebhookInfo,
} from "@/lib/types";
import type { Column, TranslateFunc } from "../types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatAge } from "../lib/utils";
import { getStatusBadgeToneClass } from "../components/badges/statusBadgeStyles";

// Node columns
export const nodeColumns: Column<NodeInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (node) => (
      <span className="font-medium">{node.name}</span>
    ),
  },
  {
    key: "status",
    label: "STATUS",
    sortable: true,
    render: (node) => (
      <Badge
        variant="outline"
        className={cn(
          "border font-medium",
          getStatusBadgeToneClass(node.status === "Ready" ? "success" : "warning")
        )}
      >
        {node.status}
      </Badge>
    ),
  },
  {
    key: "roles",
    label: "ROLES",
    sortable: true,
    render: (node) => node.roles.join(", ") || "worker",
  },
  { key: "version", label: "VERSION", sortable: true },
  { key: "internal_ip", label: "INTERNAL IP", sortable: true },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (node) => (node.created_at ? formatAge(node.created_at) : "-"),
  },
];

export function getNodeColumns(t: TranslateFunc): Column<NodeInfo>[] {
  return [
    {
      key: "name",
      label: t("columns.name"),
      sortable: true,
      render: (node) => <span className="font-medium">{node.name}</span>,
    },
    {
      key: "status",
      label: t("columns.status"),
      sortable: true,
      render: (node) => (
        <Badge
          variant="outline"
          className={cn(
            "border font-medium",
            getStatusBadgeToneClass(node.status === "Ready" ? "success" : "warning")
          )}
        >
          {node.status}
        </Badge>
      ),
    },
    {
      key: "roles",
      label: t("columns.roles"),
      sortable: true,
      render: (node) => node.roles.join(", ") || "worker",
    },
    { key: "version", label: t("columns.version"), sortable: true },
    { key: "internal_ip", label: t("columns.internalIp"), sortable: true },
    {
      key: "created_at",
      label: t("columns.age"),
      sortable: true,
      render: (node) => (node.created_at ? formatAge(node.created_at) : "-"),
    },
  ];
}

// CRD columns
export const crdColumns: Column<CRDInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (crd) => <span className="font-medium text-xs font-mono">{crd.name}</span>,
  },
  {
    key: "group",
    label: "GROUP",
    sortable: true,
    render: (crd) => <span className="text-xs">{crd.group}</span>,
  },
  {
    key: "kind",
    label: "KIND",
    sortable: true,
    render: (crd) => crd.kind,
  },
  {
    key: "scope",
    label: "SCOPE",
    sortable: true,
    render: (crd) => (
      <Badge
        variant="outline"
        className={cn(
          "border-0 text-[10px]",
          crd.scope === "Namespaced"
            ? "bg-blue-500/10 text-blue-500"
            : "bg-purple-500/10 text-purple-500"
        )}
      >
        {crd.scope}
      </Badge>
    ),
  },
  {
    key: "versions",
    label: "VERSIONS",
    sortable: false,
    render: (crd) => (
      <span className="text-xs text-muted-foreground">
        {crd.versions.map(v => v.name).join(", ")}
      </span>
    ),
  },
  {
    key: "conditions_ready",
    label: "STATUS",
    sortable: true,
    render: (crd) => (
      <Badge
        variant="outline"
        className={cn(
          "border-0",
          crd.conditions_ready
            ? "bg-green-500/10 text-green-500"
            : "bg-yellow-500/10 text-yellow-500"
        )}
      >
        {crd.conditions_ready ? "Established" : "Pending"}
      </Badge>
    ),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (crd) => (crd.created_at ? formatAge(crd.created_at) : "-"),
  },
];

// PriorityClass columns
export const priorityClassColumns: Column<PriorityClassInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (pc) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{pc.name}</span>
        {pc.global_default && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-yellow-500/10 text-yellow-500">
            default
          </Badge>
        )}
      </div>
    ),
  },
  {
    key: "value",
    label: "VALUE",
    sortable: true,
    render: (pc) => (
      <span className="font-mono text-xs">
        {pc.value.toLocaleString()}
      </span>
    ),
  },
  {
    key: "preemption_policy",
    label: "PREEMPTION",
    sortable: true,
    render: (pc) => (
      <Badge
        variant="outline"
        className={cn(
          "border-0 text-[10px]",
          pc.preemption_policy === "PreemptLowerPriority"
            ? "bg-orange-500/10 text-orange-500"
            : "bg-muted text-muted-foreground"
        )}
      >
        {pc.preemption_policy}
      </Badge>
    ),
  },
  {
    key: "description",
    label: "DESCRIPTION",
    sortable: false,
    render: (pc) => (
      <span className="text-xs text-muted-foreground truncate max-w-xs">
        {pc.description || "-"}
      </span>
    ),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (pc) => (pc.created_at ? formatAge(pc.created_at) : "-"),
  },
];

// RuntimeClass columns
export const runtimeClassColumns: Column<RuntimeClassInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (rc) => <span className="font-medium">{rc.name}</span>,
  },
  {
    key: "handler",
    label: "HANDLER",
    sortable: true,
    render: (rc) => <span className="font-mono text-xs">{rc.handler}</span>,
  },
  {
    key: "scheduling_tolerations_count",
    label: "TOLERATIONS",
    sortable: true,
    render: (rc) => rc.scheduling_tolerations_count || "-",
  },
  {
    key: "scheduling_node_selector",
    label: "NODE SELECTOR",
    sortable: false,
    render: (rc) => {
      if (!rc.scheduling_node_selector) return "-";
      const count = Object.keys(rc.scheduling_node_selector).length;
      return <span className="text-xs text-muted-foreground">{count} label{count > 1 ? "s" : ""}</span>;
    },
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (rc) => (rc.created_at ? formatAge(rc.created_at) : "-"),
  },
];

// MutatingWebhook columns
export const mutatingWebhookColumns: Column<MutatingWebhookInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (mw) => <span className="font-medium text-xs">{mw.name}</span>,
  },
  {
    key: "webhooks_count",
    label: "WEBHOOKS",
    sortable: true,
    render: (mw) => mw.webhooks_count,
  },
  {
    key: "webhooks",
    label: "SERVICES",
    sortable: false,
    render: (mw) => {
      const services = mw.webhooks
        .filter(w => w.client_config_service)
        .map(w => w.client_config_service)
        .slice(0, 2);
      if (services.length === 0) return "-";
      return (
        <span className="text-xs text-muted-foreground">
          {services.join(", ")}{mw.webhooks.length > 2 ? "..." : ""}
        </span>
      );
    },
  },
  {
    key: "failure_policy",
    label: "FAILURE POLICY",
    sortable: false,
    render: (mw) => {
      const policy = mw.webhooks[0]?.failure_policy || "-";
      return (
        <Badge
          variant="outline"
          className={cn(
            "border-0 text-[10px]",
            policy === "Fail"
              ? "bg-red-500/10 text-red-500"
              : "bg-muted text-muted-foreground"
          )}
        >
          {policy}
        </Badge>
      );
    },
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (mw) => (mw.created_at ? formatAge(mw.created_at) : "-"),
  },
];

// ValidatingWebhook columns
export const validatingWebhookColumns: Column<ValidatingWebhookInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (vw) => <span className="font-medium text-xs">{vw.name}</span>,
  },
  {
    key: "webhooks_count",
    label: "WEBHOOKS",
    sortable: true,
    render: (vw) => vw.webhooks_count,
  },
  {
    key: "webhooks",
    label: "SERVICES",
    sortable: false,
    render: (vw) => {
      const services = vw.webhooks
        .filter(w => w.client_config_service)
        .map(w => w.client_config_service)
        .slice(0, 2);
      if (services.length === 0) return "-";
      return (
        <span className="text-xs text-muted-foreground">
          {services.join(", ")}{vw.webhooks.length > 2 ? "..." : ""}
        </span>
      );
    },
  },
  {
    key: "failure_policy",
    label: "FAILURE POLICY",
    sortable: false,
    render: (vw) => {
      const policy = vw.webhooks[0]?.failure_policy || "-";
      return (
        <Badge
          variant="outline"
          className={cn(
            "border-0 text-[10px]",
            policy === "Fail"
              ? "bg-red-500/10 text-red-500"
              : "bg-muted text-muted-foreground"
          )}
        >
          {policy}
        </Badge>
      );
    },
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (vw) => (vw.created_at ? formatAge(vw.created_at) : "-"),
  },
];
