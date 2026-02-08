import type {
  ConfigMapInfo,
  SecretInfo,
  NamespaceInfo,
  EventInfo,
  LeaseInfo,
} from "@/lib/types";
import type { Column, TranslateFunc } from "../types";
import { Badge } from "@/components/ui/badge";
import { NamespaceColorDot } from "../components/NamespaceColorDot";
import { EventTypeBadge } from "../components/badges/EventTypeBadge";
import { NamespaceStatusBadge } from "../components/badges/NamespaceStatusBadge";
import { formatAge } from "../lib/utils";

// ConfigMap columns
export const configMapColumns: Column<ConfigMapInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (cm) => <span className="font-medium">{cm.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (cm) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={cm.namespace} />
        <span>{cm.namespace}</span>
      </div>
    ),
  },
  {
    key: "data_keys",
    label: "DATA",
    sortable: true,
    render: (cm) => (
      <span className="text-muted-foreground">{cm.data_keys.length} keys</span>
    ),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (cm) => (cm.created_at ? formatAge(cm.created_at) : "-"),
  },
];

export function getConfigMapColumns(t: TranslateFunc): Column<ConfigMapInfo>[] {
  return [
    {
      key: "name",
      label: t("columns.name"),
      sortable: true,
      render: (cm) => <span className="font-medium">{cm.name}</span>,
    },
    {
      key: "namespace",
      label: t("columns.namespace"),
      sortable: true,
      render: (cm) => (
        <div className="flex items-center gap-2">
          <NamespaceColorDot namespace={cm.namespace} />
          <span>{cm.namespace}</span>
        </div>
      ),
    },
    {
      key: "data_keys",
      label: t("columns.data"),
      sortable: true,
      render: (cm) => <span className="text-muted-foreground">{cm.data_keys.length} keys</span>,
    },
    {
      key: "created_at",
      label: t("columns.age"),
      sortable: true,
      render: (cm) => (cm.created_at ? formatAge(cm.created_at) : "-"),
    },
  ];
}

// Secret columns
export const secretColumns: Column<SecretInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (s) => <span className="font-medium">{s.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (s) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={s.namespace} />
        <span>{s.namespace}</span>
      </div>
    ),
  },
  { key: "secret_type", label: "TYPE", sortable: true },
  {
    key: "data_keys",
    label: "DATA",
    sortable: true,
    render: (s) => (
      <span className="text-muted-foreground">{s.data_keys.length} keys</span>
    ),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (s) => (s.created_at ? formatAge(s.created_at) : "-"),
  },
];

export function getSecretColumns(t: TranslateFunc): Column<SecretInfo>[] {
  return [
    {
      key: "name",
      label: t("columns.name"),
      sortable: true,
      render: (s) => <span className="font-medium">{s.name}</span>,
    },
    {
      key: "namespace",
      label: t("columns.namespace"),
      sortable: true,
      render: (s) => (
        <div className="flex items-center gap-2">
          <NamespaceColorDot namespace={s.namespace} />
          <span>{s.namespace}</span>
        </div>
      ),
    },
    { key: "secret_type", label: t("columns.type"), sortable: true },
    {
      key: "data_keys",
      label: t("columns.data"),
      sortable: true,
      render: (s) => <span className="text-muted-foreground">{s.data_keys.length} keys</span>,
    },
    {
      key: "created_at",
      label: t("columns.age"),
      sortable: true,
      render: (s) => (s.created_at ? formatAge(s.created_at) : "-"),
    },
  ];
}

// Namespace columns
export const namespaceColumns: Column<NamespaceInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (ns) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={ns.name} />
        <span className="font-medium">{ns.name}</span>
      </div>
    ),
  },
  {
    key: "status",
    label: "STATUS",
    sortable: true,
    render: (ns) => <NamespaceStatusBadge status={ns.status} />,
  },
  {
    key: "labels",
    label: "LABELS",
    sortable: false,
    render: (ns) => {
      const labelCount = Object.keys(ns.labels).length;
      return labelCount > 0 ? `${labelCount} labels` : "-";
    },
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (ns) => (ns.created_at ? formatAge(ns.created_at) : "-"),
  },
];

export function getNamespaceColumns(t: TranslateFunc): Column<NamespaceInfo>[] {
  return [
    {
      key: "name",
      label: t("columns.name"),
      sortable: true,
      render: (ns) => (
        <div className="flex items-center gap-2">
          <NamespaceColorDot namespace={ns.name} />
          <span className="font-medium">{ns.name}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: t("columns.status"),
      sortable: true,
      render: (ns) => <NamespaceStatusBadge status={ns.status} />,
    },
    {
      key: "labels",
      label: t("columns.labels"),
      sortable: false,
      render: (ns) => {
        const labelCount = Object.keys(ns.labels).length;
        return labelCount > 0 ? `${labelCount} labels` : "-";
      },
    },
    {
      key: "created_at",
      label: t("columns.age"),
      sortable: true,
      render: (ns) => (ns.created_at ? formatAge(ns.created_at) : "-"),
    },
  ];
}

// Event columns
export const eventColumns: Column<EventInfo>[] = [
  {
    key: "event_type",
    label: "TYPE",
    sortable: true,
    width: "80px",
    render: (event) => <EventTypeBadge type={event.event_type} />,
  },
  {
    key: "reason",
    label: "REASON",
    sortable: true,
    width: "140px",
    render: (event) => (
      <span className="font-medium">{event.reason || "-"}</span>
    ),
  },
  {
    key: "involved_object",
    label: "OBJECT",
    sortable: false,
    width: "200px",
    render: (event) => (
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{event.involved_object.kind}</span>
        <span className="font-medium truncate max-w-[180px]">{event.involved_object.name}</span>
      </div>
    ),
  },
  {
    key: "message",
    label: "MESSAGE",
    sortable: false,
    render: (event) => (
      <span className="text-muted-foreground line-clamp-2">{event.message || "-"}</span>
    ),
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    width: "140px",
    render: (event) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={event.namespace} />
        <span className="truncate">{event.namespace}</span>
      </div>
    ),
  },
  {
    key: "count",
    label: "COUNT",
    sortable: true,
    width: "70px",
    render: (event) => (
      <Badge variant="outline" className="font-mono">
        {event.count}
      </Badge>
    ),
  },
  {
    key: "last_timestamp",
    label: "LAST SEEN",
    sortable: true,
    width: "100px",
    render: (event) => (event.last_timestamp ? formatAge(event.last_timestamp) : "-"),
  },
];

// Lease columns
export const leaseColumns: Column<LeaseInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (lease) => <span className="font-medium">{lease.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    width: "140px",
    render: (lease) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={lease.namespace} />
        <span className="truncate">{lease.namespace}</span>
      </div>
    ),
  },
  {
    key: "holder_identity",
    label: "HOLDER",
    sortable: true,
    render: (lease) => (
      <span className="font-mono text-sm truncate max-w-[200px]">
        {lease.holder_identity || "-"}
      </span>
    ),
  },
  {
    key: "lease_duration_seconds",
    label: "DURATION",
    sortable: true,
    width: "100px",
    render: (lease) => (
      lease.lease_duration_seconds ? `${lease.lease_duration_seconds}s` : "-"
    ),
  },
  {
    key: "lease_transitions",
    label: "TRANSITIONS",
    sortable: true,
    width: "110px",
    render: (lease) => (
      <Badge variant="outline" className="font-mono">
        {lease.lease_transitions ?? 0}
      </Badge>
    ),
  },
  {
    key: "renew_time",
    label: "LAST RENEWED",
    sortable: true,
    width: "120px",
    render: (lease) => (lease.renew_time ? formatAge(lease.renew_time) : "-"),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    width: "80px",
    render: (lease) => (lease.created_at ? formatAge(lease.created_at) : "-"),
  },
];
