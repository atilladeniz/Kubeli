import type {
  ServiceAccountInfo,
  RoleInfo,
  RoleBindingInfo,
  ClusterRoleInfo,
  ClusterRoleBindingInfo,
} from "@/lib/types";
import type { Column } from "../types";
import { Badge } from "@/components/ui/badge";
import { NamespaceColorDot } from "../components/NamespaceColorDot";
import { BooleanStatusBadge } from "../components/badges/BooleanStatusBadge";
import { AggregatedBadge } from "../components/badges/AggregatedBadge";
import { formatAge } from "../lib/utils";

export const serviceAccountColumns: Column<ServiceAccountInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (sa) => <span className="font-medium">{sa.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (sa) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={sa.namespace} />
        <span>{sa.namespace}</span>
      </div>
    ),
  },
  {
    key: "secrets",
    label: "SECRETS",
    sortable: true,
    render: (sa) => sa.secrets.length,
  },
  {
    key: "image_pull_secrets",
    label: "IMAGE PULL SECRETS",
    sortable: true,
    render: (sa) => sa.image_pull_secrets.length,
  },
  {
    key: "automount",
    label: "AUTOMOUNT TOKEN",
    sortable: true,
    render: (sa) => (
      <BooleanStatusBadge
        value={sa.automount_service_account_token !== false}
        variant="yesNo"
      />
    ),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (sa) => (sa.created_at ? formatAge(sa.created_at) : "-"),
  },
];

export const roleColumns: Column<RoleInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (role) => <span className="font-medium">{role.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (role) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={role.namespace} />
        <span>{role.namespace}</span>
      </div>
    ),
  },
  {
    key: "rules_count",
    label: "RULES",
    sortable: true,
    render: (role) => role.rules_count,
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (role) => (role.created_at ? formatAge(role.created_at) : "-"),
  },
];

export const roleBindingColumns: Column<RoleBindingInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (rb) => <span className="font-medium">{rb.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (rb) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={rb.namespace} />
        <span>{rb.namespace}</span>
      </div>
    ),
  },
  {
    key: "role",
    label: "ROLE",
    sortable: true,
    render: (rb) => (
      <div className="flex items-center gap-1">
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
          {rb.role_kind}
        </Badge>
        <span>{rb.role_name}</span>
      </div>
    ),
  },
  {
    key: "subjects_count",
    label: "SUBJECTS",
    sortable: true,
    render: (rb) => rb.subjects_count,
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (rb) => (rb.created_at ? formatAge(rb.created_at) : "-"),
  },
];

export const clusterRoleColumns: Column<ClusterRoleInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (cr) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{cr.name}</span>
        {cr.aggregation_rule && (
          <AggregatedBadge />
        )}
      </div>
    ),
  },
  {
    key: "rules_count",
    label: "RULES",
    sortable: true,
    render: (cr) => cr.rules_count,
  },
  {
    key: "aggregation_rule",
    label: "AGGREGATION LABELS",
    sortable: false,
    render: (cr) => {
      if (!cr.aggregation_rule || cr.aggregation_rule.length === 0) return "-";
      return (
        <span className="text-xs text-muted-foreground">
          {cr.aggregation_rule.length} label{cr.aggregation_rule.length > 1 ? "s" : ""}
        </span>
      );
    },
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (cr) => (cr.created_at ? formatAge(cr.created_at) : "-"),
  },
];

export const clusterRoleBindingColumns: Column<ClusterRoleBindingInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (crb) => <span className="font-medium">{crb.name}</span>,
  },
  {
    key: "role_name",
    label: "ROLE",
    sortable: true,
    render: (crb) => (
      <div className="flex items-center gap-1">
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-purple-500/10 text-purple-500 border-purple-500/20">
          ClusterRole
        </Badge>
        <span>{crb.role_name}</span>
      </div>
    ),
  },
  {
    key: "subjects_count",
    label: "SUBJECTS",
    sortable: true,
    render: (crb) => crb.subjects_count,
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (crb) => (crb.created_at ? formatAge(crb.created_at) : "-"),
  },
];
