import type {
  ServiceInfo,
  IngressInfo,
  EndpointSliceInfo,
  NetworkPolicyInfo,
  IngressClassInfo,
} from "@/lib/types";
import type { Column, TranslateFunc } from "./types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { NamespaceColorDot } from "../components/NamespaceColorDot";
import { formatAge } from "../lib/utils";

// Service columns
export const serviceColumns: Column<ServiceInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (svc) => <span className="font-medium">{svc.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (svc) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={svc.namespace} />
        <span>{svc.namespace}</span>
      </div>
    ),
  },
  { key: "service_type", label: "TYPE", sortable: true },
  { key: "cluster_ip", label: "CLUSTER IP", sortable: true },
  {
    key: "ports",
    label: "PORTS",
    render: (svc) =>
      svc.ports
        .map((p) => `${p.port}${p.target_port ? `:${p.target_port}` : ""}`)
        .join(", "),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (svc) => (svc.created_at ? formatAge(svc.created_at) : "-"),
  },
];

export function getServiceColumns(t: TranslateFunc): Column<ServiceInfo>[] {
  return [
    {
      key: "name",
      label: t("columns.name"),
      sortable: true,
      render: (svc) => <span className="font-medium">{svc.name}</span>,
    },
    {
      key: "namespace",
      label: t("columns.namespace"),
      sortable: true,
      render: (svc) => (
        <div className="flex items-center gap-2">
          <NamespaceColorDot namespace={svc.namespace} />
          <span>{svc.namespace}</span>
        </div>
      ),
    },
    { key: "service_type", label: t("columns.type"), sortable: true },
    { key: "cluster_ip", label: t("columns.clusterIp"), sortable: true },
    {
      key: "ports",
      label: t("columns.ports"),
      render: (svc) => svc.ports.map((p) => `${p.port}${p.target_port ? `:${p.target_port}` : ""}`).join(", "),
    },
    {
      key: "created_at",
      label: t("columns.age"),
      sortable: true,
      render: (svc) => (svc.created_at ? formatAge(svc.created_at) : "-"),
    },
  ];
}

// Ingress columns
export const ingressColumns: Column<IngressInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (ing) => <span className="font-medium">{ing.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (ing) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={ing.namespace} />
        <span>{ing.namespace}</span>
      </div>
    ),
  },
  {
    key: "ingress_class_name",
    label: "CLASS",
    sortable: true,
    render: (ing) => ing.ingress_class_name || "-",
  },
  {
    key: "hosts",
    label: "HOSTS",
    sortable: false,
    render: (ing) => {
      const hosts = ing.rules
        .map((r) => r.host)
        .filter((h): h is string => h !== null);
      if (hosts.length === 0) return "*";
      if (hosts.length === 1) return hosts[0];
      return (
        <span title={hosts.join(", ")}>
          {hosts[0]} <span className="text-muted-foreground">+{hosts.length - 1}</span>
        </span>
      );
    },
  },
  {
    key: "address",
    label: "ADDRESS",
    sortable: false,
    render: (ing) => ing.load_balancer_ip || ing.load_balancer_hostname || "-",
  },
  {
    key: "tls",
    label: "TLS",
    sortable: false,
    render: (ing) => (
      <Badge
        variant="outline"
        className={cn(
          ing.tls.length > 0
            ? "bg-green-500/10 text-green-500"
            : "bg-muted text-muted-foreground"
        )}
      >
        {ing.tls.length > 0 ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (ing) => (ing.created_at ? formatAge(ing.created_at) : "-"),
  },
];

// EndpointSlice columns
export const endpointSliceColumns: Column<EndpointSliceInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (es) => <span className="font-medium">{es.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (es) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={es.namespace} />
        <span>{es.namespace}</span>
      </div>
    ),
  },
  {
    key: "service_name",
    label: "SERVICE",
    sortable: true,
    render: (es) => es.service_name || "-",
  },
  {
    key: "address_type",
    label: "ADDRESS TYPE",
    sortable: true,
    render: (es) => es.address_type,
  },
  {
    key: "endpoints_count",
    label: "ENDPOINTS",
    sortable: false,
    render: (es) => {
      const ready = es.endpoints.filter((e) => e.conditions.ready).length;
      const total = es.endpoints.length;
      return (
        <span className={cn(ready < total && "text-yellow-500")}>
          {ready}/{total}
        </span>
      );
    },
  },
  {
    key: "ports",
    label: "PORTS",
    sortable: false,
    render: (es) => {
      if (es.ports.length === 0) return "-";
      return es.ports.map((p) => `${p.port}/${p.protocol}`).join(", ");
    },
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (es) => (es.created_at ? formatAge(es.created_at) : "-"),
  },
];

// NetworkPolicy columns
export const networkPolicyColumns: Column<NetworkPolicyInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (np) => <span className="font-medium">{np.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (np) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={np.namespace} />
        <span>{np.namespace}</span>
      </div>
    ),
  },
  {
    key: "policy_types",
    label: "POLICY TYPES",
    sortable: false,
    render: (np) => (
      <div className="flex gap-1">
        {np.policy_types.map((type) => (
          <Badge key={type} variant="outline" className="text-xs">
            {type}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    key: "pod_selector",
    label: "POD SELECTOR",
    sortable: false,
    render: (np) => {
      const entries = Object.entries(np.pod_selector);
      if (entries.length === 0) return <span className="text-muted-foreground">(all pods)</span>;
      return (
        <span className="text-xs">
          {entries.map(([k, v]) => `${k}=${v}`).join(", ")}
        </span>
      );
    },
  },
  {
    key: "ingress_rules",
    label: "INGRESS",
    sortable: false,
    render: (np) => np.ingress_rules.length || "-",
  },
  {
    key: "egress_rules",
    label: "EGRESS",
    sortable: false,
    render: (np) => np.egress_rules.length || "-",
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (np) => (np.created_at ? formatAge(np.created_at) : "-"),
  },
];

// IngressClass columns
export const ingressClassColumns: Column<IngressClassInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (ic) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{ic.name}</span>
        {ic.is_default && (
          <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
            Default
          </Badge>
        )}
      </div>
    ),
  },
  {
    key: "controller",
    label: "CONTROLLER",
    sortable: true,
    render: (ic) => ic.controller || "-",
  },
  {
    key: "parameters",
    label: "PARAMETERS",
    sortable: false,
    render: (ic) => {
      if (!ic.parameters_kind) return "-";
      return `${ic.parameters_kind}/${ic.parameters_name}`;
    },
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (ic) => (ic.created_at ? formatAge(ic.created_at) : "-"),
  },
];
