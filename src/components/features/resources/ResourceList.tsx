"use client";

import { useState, useMemo } from "react";
import {
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Circle,
  AlertCircle,
  Radio,
  X,
} from "lucide-react";
import type {
  PodInfo,
  DeploymentInfo,
  ServiceInfo,
  ConfigMapInfo,
  SecretInfo,
  NodeInfo,
  NamespaceInfo,
  EventInfo,
  LeaseInfo,
  ReplicaSetInfo,
  DaemonSetInfo,
  StatefulSetInfo,
  JobInfo,
  CronJobInfo,
  IngressInfo,
  EndpointSliceInfo,
  NetworkPolicyInfo,
  IngressClassInfo,
  HPAInfo,
  LimitRangeInfo,
  ResourceQuotaInfo,
  PDBInfo,
  PVInfo,
  PVCInfo,
  StorageClassInfo,
  CSIDriverInfo,
  CSINodeInfo,
  VolumeAttachmentInfo,
  ServiceAccountInfo,
  RoleInfo,
  RoleBindingInfo,
  ClusterRoleInfo,
  ClusterRoleBindingInfo,
  CRDInfo,
  PriorityClassInfo,
  RuntimeClassInfo,
  MutatingWebhookInfo,
  ValidatingWebhookInfo,
  HelmReleaseInfo,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { getNamespaceColor } from "@/lib/utils/colors";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "next-intl";

// Context menu item definition
export interface ContextMenuItemDef {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
  separator?: boolean;
}

export type SortDirection = "asc" | "desc";

interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  width?: string;
}

export interface FilterOption<T> {
  key: string;
  label: string;
  /** Count will be calculated from data */
  predicate: (item: T) => boolean;
  /** Optional color for the chip */
  color?: "default" | "green" | "yellow" | "red" | "blue";
}

export interface BulkAction<T> {
  key: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive";
  onAction: (items: T[]) => void | Promise<void>;
}

interface ResourceListProps<T> {
  title: string;
  data: T[];
  columns: Column<T>[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  isWatching?: boolean;
  onStartWatch?: () => void;
  onStopWatch?: () => void;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  getRowKey: (item: T) => string;
  getRowClassName?: (item: T) => string;
  /** Extract namespace from item for row background coloring */
  getRowNamespace?: (item: T) => string;
  contextMenuItems?: (item: T) => ContextMenuItemDef[];
  /** Filter options for quick filtering */
  filterOptions?: FilterOption<T>[];
  /** Bulk actions available when items are selected */
  bulkActions?: BulkAction<T>[];
  // Controlled sorting
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSortChange?: (key: string | null, direction: SortDirection) => void;
}

export function ResourceList<T>({
  title,
  data,
  columns,
  isLoading,
  error,
  onRefresh,
  isWatching,
  onStartWatch,
  onStopWatch,
  onRowClick,
  emptyMessage,
  getRowKey,
  getRowClassName,
  getRowNamespace,
  contextMenuItems,
  filterOptions,
  bulkActions,
  sortKey: controlledSortKey,
  sortDirection: controlledSortDirection,
  onSortChange,
}: ResourceListProps<T>) {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  // Use controlled or uncontrolled sorting
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDirection, setInternalSortDirection] =
    useState<SortDirection>("asc");

  const isControlled = onSortChange !== undefined;
  const sortKey = isControlled ? controlledSortKey ?? null : internalSortKey;
  const sortDirection = isControlled
    ? controlledSortDirection ?? "asc"
    : internalSortDirection;

  // Calculate filter counts
  const filterCounts = useMemo(() => {
    if (!filterOptions) return {};
    return filterOptions.reduce((acc, filter) => {
      acc[filter.key] = data.filter(filter.predicate).length;
      return acc;
    }, {} as Record<string, number>);
  }, [data, filterOptions]);

  const filteredData = useMemo(() => {
    let result = [...data];

    // Quick filter
    if (activeFilter && filterOptions) {
      const filter = filterOptions.find((f) => f.key === activeFilter);
      if (filter) {
        result = result.filter(filter.predicate);
      }
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) =>
        Object.values(item as Record<string, unknown>).some((value) =>
          String(value).toLowerCase().includes(query)
        )
      );
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        const aValue = (a as Record<string, unknown>)[sortKey];
        const bValue = (b as Record<string, unknown>)[sortKey];

        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        const comparison = String(aValue).localeCompare(String(bValue));
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [data, searchQuery, sortKey, sortDirection, activeFilter, filterOptions]);

  const handleSort = (key: string) => {
    const newDirection =
      sortKey === key && sortDirection === "asc" ? "desc" : "asc";
    const newKey = key;

    if (isControlled) {
      onSortChange?.(newKey, newDirection);
    } else {
      setInternalSortKey(newKey);
      setInternalSortDirection(newDirection);
    }
  };

  // Selection helpers
  const hasBulkActions = bulkActions && bulkActions.length > 0;
  const allSelected =
    filteredData.length > 0 &&
    filteredData.every((item) => selectedKeys.has(getRowKey(item)));
  const someSelected = filteredData.some((item) =>
    selectedKeys.has(getRowKey(item))
  );

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filteredData.map(getRowKey)));
    }
  };

  const toggleSelect = (key: string) => {
    const newSelected = new Set(selectedKeys);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedKeys(newSelected);
  };

  const selectedItems = filteredData.filter((item) =>
    selectedKeys.has(getRowKey(item))
  );

  const handleBulkAction = async (action: BulkAction<T>) => {
    await action.onAction(selectedItems);
    setSelectedKeys(new Set());
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Badge variant="secondary" className="rounded-full">
            {filteredData.length}
          </Badge>

          {/* Quick filters */}
          {filterOptions && filterOptions.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => setActiveFilter(null)}
                className={cn(
                  "px-2 py-0.5 text-xs rounded-full transition-colors",
                  activeFilter === null
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {t("common.all")}
              </button>
              {filterOptions.map((filter) => {
                const count = filterCounts[filter.key] || 0;
                const isActive = activeFilter === filter.key;
                const colorClasses = {
                  default: isActive
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                  green: isActive
                    ? "bg-green-500 text-white"
                    : "bg-green-500/10 text-green-500 hover:bg-green-500/20",
                  yellow: isActive
                    ? "bg-yellow-500 text-black"
                    : "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
                  red: isActive
                    ? "bg-red-500 text-white"
                    : "bg-red-500/10 text-red-500 hover:bg-red-500/20",
                  blue: isActive
                    ? "bg-blue-500 text-white"
                    : "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
                };
                return (
                  <button
                    key={filter.key}
                    onClick={() =>
                      setActiveFilter(isActive ? null : filter.key)
                    }
                    className={cn(
                      "px-2 py-0.5 text-xs rounded-full transition-colors flex items-center gap-1",
                      colorClasses[filter.color || "default"]
                    )}
                  >
                    {filter.label}
                    <span className="opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={`${t("common.search")}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 pl-8"
            />
          </div>

          {/* Watch toggle */}
          {onStartWatch && onStopWatch && (
            <Button
              variant={isWatching ? "default" : "outline"}
              size="sm"
              onClick={isWatching ? onStopWatch : onStartWatch}
              className={cn(isWatching && "bg-green-600 hover:bg-green-700")}
            >
              <Radio
                className={cn("size-3.5", isWatching && "animate-pulse")}
              />
              {isWatching ? t("watch.watching") : t("watch.watch")}
            </Button>
          )}

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn("size-3.5", isLoading && "animate-spin")}
            />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        {isLoading && data.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <RefreshCw className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Circle className="size-12 stroke-1" />
            <p>{emptyMessage || t("common.noData")}</p>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  {hasBulkActions && (
                    <TableHead className="w-8 bg-background pl-3.5">
                      <Checkbox
                        checked={
                          someSelected
                            ? allSelected
                              ? true
                              : "indeterminate"
                            : false
                        }
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
                  {columns.map((column) => (
                    <TableHead
                      key={String(column.key)}
                      className={cn(
                        "text-xs font-medium tracking-wider bg-background",
                        column.width
                      )}
                    >
                      {column.sortable ? (
                        <button
                          onClick={() => handleSort(String(column.key))}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          {column.label}
                          {sortKey === column.key &&
                            (sortDirection === "asc" ? (
                              <ChevronUp className="size-3" />
                            ) : (
                              <ChevronDown className="size-3" />
                            ))}
                        </button>
                      ) : (
                        column.label
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => {
                  const namespace = getRowNamespace?.(item);
                  const namespaceColor = namespace
                    ? getNamespaceColor(namespace)
                    : null;
                  const itemKey = getRowKey(item);
                  const isSelected = selectedKeys.has(itemKey);

                  const rowContent = (
                    <TableRow
                      key={itemKey}
                      onClick={() => onRowClick?.(item)}
                      className={cn(
                        onRowClick && "cursor-pointer",
                        namespaceColor && "border-l-4",
                        namespaceColor?.borderLeft,
                        isSelected && "bg-muted/50",
                        getRowClassName?.(item)
                      )}
                    >
                      {hasBulkActions && (
                        <TableCell className="w-8 pl-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(itemKey)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${itemKey}`}
                          />
                        </TableCell>
                      )}
                      {columns.map((column) => (
                        <TableCell key={String(column.key)} className="text-sm">
                          {column.render
                            ? column.render(item)
                            : String(
                                (item as Record<string, unknown>)[
                                  String(column.key)
                                ] ?? "-"
                              )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );

                  if (contextMenuItems) {
                    const menuItems = contextMenuItems(item);
                    return (
                      <ContextMenu key={getRowKey(item)}>
                        <ContextMenuTrigger asChild>
                          {rowContent}
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                          {menuItems.map((menuItem, index) =>
                            menuItem.separator ? (
                              <ContextMenuSeparator key={`sep-${index}`} />
                            ) : (
                              <ContextMenuItem
                                key={menuItem.label}
                                onClick={menuItem.onClick}
                                disabled={menuItem.disabled}
                                variant={menuItem.variant}
                                className="gap-2"
                              >
                                {menuItem.icon}
                                {menuItem.label}
                              </ContextMenuItem>
                            )
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  }

                  return rowContent;
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Bulk Action Bar - Fixed at bottom */}
      {hasBulkActions && selectedKeys.size > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-border bg-background px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {t("common.selected", { count: selectedKeys.size })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedKeys(new Set())}
              className="h-7 px-2"
            >
              <X className="size-3.5" />
              {t("logs.clear")}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {bulkActions?.map((action) => (
              <Button
                key={action.key}
                variant={
                  action.variant === "destructive" ? "destructive" : "outline"
                }
                size="sm"
                onClick={() => handleBulkAction(action)}
                className="h-7"
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Translation function type
type TranslateFunc = (key: string) => string;

// Column label to translation key mapping
const columnLabelToKey: Record<string, string> = {
  "NAME": "columns.name",
  "NAMESPACE": "columns.namespace",
  "READY": "columns.ready",
  "STATUS": "columns.status",
  "RESTARTS": "columns.restarts",
  "NODE": "columns.node",
  "AGE": "columns.age",
  "AVAILABLE": "columns.available",
  "TYPE": "columns.type",
  "CLUSTER IP": "columns.clusterIp",
  "PORTS": "columns.ports",
  "DATA": "columns.data",
  "HOLDER": "columns.holder",
  "DURATION": "columns.duration",
  "TRANSITIONS": "columns.transitions",
  "LAST RENEWED": "columns.lastRenewed",
  "OWNER": "columns.owner",
  "DESIRED": "columns.desired",
  "CURRENT": "columns.current",
  "SERVICE": "columns.service",
  "COMPLETIONS": "columns.completions",
  "SCHEDULE": "columns.schedule",
  "SUSPEND": "columns.suspend",
  "ACTIVE": "columns.active",
  "LAST SCHEDULE": "columns.lastSchedule",
  "CLASS": "columns.class",
  "HOSTS": "columns.hosts",
  "ADDRESS": "columns.address",
  "TLS": "columns.tls",
  "ADDRESS TYPE": "columns.addressType",
  "ENDPOINTS": "columns.endpoints",
  "POLICY TYPES": "columns.policyTypes",
  "POD SELECTOR": "columns.podSelector",
  "INGRESS": "columns.ingress",
  "EGRESS": "columns.egress",
  "CONTROLLER": "columns.controller",
  "PARAMETERS": "columns.parameters",
  "REFERENCE": "columns.reference",
  "MIN": "columns.min",
  "MAX": "columns.max",
  "REPLICAS": "columns.replicas",
  "LIMITS": "columns.limits",
  "TYPES": "columns.types",
  "RESOURCES": "columns.resources",
  "SCOPES": "columns.scopes",
  "MIN AVAILABLE": "columns.minAvailable",
  "MAX UNAVAILABLE": "columns.maxUnavailable",
  "ALLOWED": "columns.allowed",
  "PODS": "columns.pods",
  "CAPACITY": "columns.capacity",
  "ACCESS MODES": "columns.accessModes",
  "RECLAIM POLICY": "columns.reclaimPolicy",
  "CLAIM": "columns.claim",
  "STORAGE CLASS": "columns.storageClass",
  "VOLUME": "columns.volume",
  "PROVISIONER": "columns.provisioner",
  "VOLUME BINDING MODE": "columns.volumeBindingMode",
  "EXPANSION": "columns.expansion",
  "ATTACH REQUIRED": "columns.attachRequired",
  "POD INFO": "columns.podInfo",
  "STORAGE CAPACITY": "columns.storageCapacity",
  "MODES": "columns.modes",
  "DRIVERS": "columns.drivers",
  "DRIVER NAMES": "columns.driverNames",
  "ATTACHER": "columns.attacher",
  "PV": "columns.pv",
  "ATTACHED": "columns.attached",
  "SECRETS": "columns.secrets",
  "IMAGE PULL SECRETS": "columns.imagePullSecrets",
  "AUTOMOUNT TOKEN": "columns.automountToken",
  "RULES": "columns.rules",
  "ROLE": "columns.role",
  "SUBJECTS": "columns.subjects",
  "AGGREGATION LABELS": "columns.aggregationLabels",
  "GROUP": "columns.group",
  "KIND": "columns.kind",
  "SCOPE": "columns.scope",
  "VERSIONS": "columns.versions",
  "VALUE": "columns.value",
  "PREEMPTION": "columns.preemption",
  "DESCRIPTION": "columns.description",
  "HANDLER": "columns.handler",
  "TOLERATIONS": "columns.tolerations",
  "NODE SELECTOR": "columns.nodeSelector",
  "WEBHOOKS": "columns.webhooks",
  "SERVICES": "columns.services",
  "FAILURE POLICY": "columns.failurePolicy",
  "CHART": "columns.chart",
  "APP VERSION": "columns.appVersion",
  "REVISION": "columns.revision",
  "UPDATED": "columns.updated",
  "REASON": "columns.reason",
  "OBJECT": "columns.object",
  "MESSAGE": "columns.message",
  "COUNT": "columns.count",
  "LAST SEEN": "columns.lastSeen",
  "ROLES": "columns.roles",
  "VERSION": "columns.version",
  "INTERNAL IP": "columns.internalIp",
  "LABELS": "columns.labels",
  "ACTIONS": "columns.actions",
};

// Generic helper to translate column labels
export function translateColumns<T>(columns: Column<T>[], t: TranslateFunc): Column<T>[] {
  return columns.map(col => ({
    ...col,
    label: columnLabelToKey[col.label] ? t(columnLabelToKey[col.label]) : col.label,
  }));
}

// Pod-specific columns
export const podColumns: Column<PodInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (pod) => (
      <span className="font-medium">{pod.name}</span>
    ),
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (pod) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={pod.namespace} />
        <span>{pod.namespace}</span>
      </div>
    ),
  },
  {
    key: "ready_containers",
    label: "READY",
    sortable: true,
    render: (pod) => (
      <span
        className={cn(
          pod.ready_containers.startsWith("0/") && "text-yellow-500"
        )}
      >
        {pod.ready_containers}
      </span>
    ),
  },
  {
    key: "phase",
    label: "STATUS",
    sortable: true,
    render: (pod) => (
      <PodPhaseBadge
        phase={pod.deletion_timestamp ? "Terminating" : pod.phase}
      />
    ),
  },
  {
    key: "restart_count",
    label: "RESTARTS",
    sortable: true,
    render: (pod) => (
      <span className={cn(pod.restart_count > 0 && "text-yellow-500")}>
        {pod.restart_count}
      </span>
    ),
  },
  { key: "node_name", label: "NODE", sortable: true },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (pod) => (pod.created_at ? formatAge(pod.created_at) : "-"),
  },
];

// Factory function for translated pod columns
export function getPodColumns(t: TranslateFunc): Column<PodInfo>[] {
  return [
    {
      key: "name",
      label: t("columns.name"),
      sortable: true,
      render: (pod) => <span className="font-medium">{pod.name}</span>,
    },
    {
      key: "namespace",
      label: t("columns.namespace"),
      sortable: true,
      render: (pod) => (
        <div className="flex items-center gap-2">
          <NamespaceColorDot namespace={pod.namespace} />
          <span>{pod.namespace}</span>
        </div>
      ),
    },
    {
      key: "ready_containers",
      label: t("columns.ready"),
      sortable: true,
      render: (pod) => (
        <span className={cn(pod.ready_containers.startsWith("0/") && "text-yellow-500")}>
          {pod.ready_containers}
        </span>
      ),
    },
    {
      key: "phase",
      label: t("columns.status"),
      sortable: true,
      render: (pod) => (
        <PodPhaseBadge
          phase={pod.deletion_timestamp ? "Terminating" : pod.phase}
        />
      ),
    },
    {
      key: "restart_count",
      label: t("columns.restarts"),
      sortable: true,
      render: (pod) => (
        <span className={cn(pod.restart_count > 0 && "text-yellow-500")}>{pod.restart_count}</span>
      ),
    },
    { key: "node_name", label: t("columns.node"), sortable: true },
    {
      key: "created_at",
      label: t("columns.age"),
      sortable: true,
      render: (pod) => (pod.created_at ? formatAge(pod.created_at) : "-"),
    },
  ];
}

// Deployment columns
export const deploymentColumns: Column<DeploymentInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (dep) => <span className="font-medium">{dep.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (dep) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={dep.namespace} />
        <span>{dep.namespace}</span>
      </div>
    ),
  },
  {
    key: "ready_replicas",
    label: "READY",
    sortable: true,
    render: (dep) => (
      <span
        className={cn(
          dep.ready_replicas < dep.replicas
            ? "text-yellow-500"
            : "text-green-500"
        )}
      >
        {dep.ready_replicas}/{dep.replicas}
      </span>
    ),
  },
  {
    key: "available_replicas",
    label: "AVAILABLE",
    sortable: true,
    render: (dep) => dep.available_replicas,
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (dep) => (dep.created_at ? formatAge(dep.created_at) : "-"),
  },
];

export function getDeploymentColumns(t: TranslateFunc): Column<DeploymentInfo>[] {
  return [
    {
      key: "name",
      label: t("columns.name"),
      sortable: true,
      render: (dep) => <span className="font-medium">{dep.name}</span>,
    },
    {
      key: "namespace",
      label: t("columns.namespace"),
      sortable: true,
      render: (dep) => (
        <div className="flex items-center gap-2">
          <NamespaceColorDot namespace={dep.namespace} />
          <span>{dep.namespace}</span>
        </div>
      ),
    },
    {
      key: "ready_replicas",
      label: t("columns.ready"),
      sortable: true,
      render: (dep) => (
        <span className={cn(dep.ready_replicas < dep.replicas ? "text-yellow-500" : "text-green-500")}>
          {dep.ready_replicas}/{dep.replicas}
        </span>
      ),
    },
    {
      key: "available_replicas",
      label: t("columns.available"),
      sortable: true,
      render: (dep) => dep.available_replicas,
    },
    {
      key: "created_at",
      label: t("columns.age"),
      sortable: true,
      render: (dep) => (dep.created_at ? formatAge(dep.created_at) : "-"),
    },
  ];
}

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
        variant={node.status === "Ready" ? "default" : "secondary"}
        className={cn(
          node.status === "Ready"
            ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
            : "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
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
          variant={node.status === "Ready" ? "default" : "secondary"}
          className={cn(
            node.status === "Ready"
              ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
              : "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
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
    render: (ns) => (
      <Badge
        variant={ns.status === "Active" ? "default" : "secondary"}
        className={cn(
          ns.status === "Active"
            ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
            : "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
        )}
      >
        {ns.status}
      </Badge>
    ),
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
      render: (ns) => (
        <Badge
          variant={ns.status === "Active" ? "default" : "secondary"}
          className={cn(
            ns.status === "Active"
              ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
              : "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
          )}
        >
          {ns.status}
        </Badge>
      ),
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

// ReplicaSet columns
export const replicaSetColumns: Column<ReplicaSetInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (rs) => <span className="font-medium">{rs.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (rs) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={rs.namespace} />
        <span>{rs.namespace}</span>
      </div>
    ),
  },
  {
    key: "ready_replicas",
    label: "READY",
    sortable: true,
    render: (rs) => (
      <span
        className={cn(
          rs.ready_replicas < rs.replicas
            ? "text-yellow-500"
            : "text-green-500"
        )}
      >
        {rs.ready_replicas}/{rs.replicas}
      </span>
    ),
  },
  {
    key: "available_replicas",
    label: "AVAILABLE",
    sortable: true,
    render: (rs) => rs.available_replicas,
  },
  {
    key: "owner_name",
    label: "OWNER",
    sortable: true,
    render: (rs) => (
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{rs.owner_kind || "-"}</span>
        <span className="truncate max-w-[150px]">{rs.owner_name || "-"}</span>
      </div>
    ),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (rs) => (rs.created_at ? formatAge(rs.created_at) : "-"),
  },
];

// DaemonSet columns
export const daemonSetColumns: Column<DaemonSetInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (ds) => <span className="font-medium">{ds.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (ds) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={ds.namespace} />
        <span>{ds.namespace}</span>
      </div>
    ),
  },
  {
    key: "desired_number_scheduled",
    label: "DESIRED",
    sortable: true,
    render: (ds) => ds.desired_number_scheduled,
  },
  {
    key: "current_number_scheduled",
    label: "CURRENT",
    sortable: true,
    render: (ds) => ds.current_number_scheduled,
  },
  {
    key: "number_ready",
    label: "READY",
    sortable: true,
    render: (ds) => (
      <span
        className={cn(
          ds.number_ready < ds.desired_number_scheduled
            ? "text-yellow-500"
            : "text-green-500"
        )}
      >
        {ds.number_ready}
      </span>
    ),
  },
  {
    key: "number_available",
    label: "AVAILABLE",
    sortable: true,
    render: (ds) => ds.number_available,
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (ds) => (ds.created_at ? formatAge(ds.created_at) : "-"),
  },
];

// StatefulSet columns
export const statefulSetColumns: Column<StatefulSetInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (sts) => <span className="font-medium">{sts.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (sts) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={sts.namespace} />
        <span>{sts.namespace}</span>
      </div>
    ),
  },
  {
    key: "ready_replicas",
    label: "READY",
    sortable: true,
    render: (sts) => (
      <span
        className={cn(
          sts.ready_replicas < sts.replicas
            ? "text-yellow-500"
            : "text-green-500"
        )}
      >
        {sts.ready_replicas}/{sts.replicas}
      </span>
    ),
  },
  {
    key: "current_replicas",
    label: "CURRENT",
    sortable: true,
    render: (sts) => sts.current_replicas,
  },
  {
    key: "service_name",
    label: "SERVICE",
    sortable: true,
    render: (sts) => sts.service_name || "-",
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (sts) => (sts.created_at ? formatAge(sts.created_at) : "-"),
  },
];

// Job columns
export const jobColumns: Column<JobInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (job) => <span className="font-medium">{job.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (job) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={job.namespace} />
        <span>{job.namespace}</span>
      </div>
    ),
  },
  {
    key: "status",
    label: "STATUS",
    sortable: true,
    render: (job) => <JobStatusBadge status={job.status} />,
  },
  {
    key: "completions",
    label: "COMPLETIONS",
    sortable: true,
    render: (job) => (
      <span>
        {job.succeeded}/{job.completions ?? 1}
      </span>
    ),
  },
  {
    key: "duration_seconds",
    label: "DURATION",
    sortable: true,
    render: (job) => (job.duration_seconds ? formatDuration(job.duration_seconds) : "-"),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (job) => (job.created_at ? formatAge(job.created_at) : "-"),
  },
];

// CronJob columns
export const cronJobColumns: Column<CronJobInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (cj) => <span className="font-medium">{cj.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (cj) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={cj.namespace} />
        <span>{cj.namespace}</span>
      </div>
    ),
  },
  {
    key: "schedule",
    label: "SCHEDULE",
    sortable: true,
    render: (cj) => (
      <code className="text-sm bg-muted px-1.5 py-0.5 rounded">{cj.schedule}</code>
    ),
  },
  {
    key: "suspend",
    label: "SUSPEND",
    sortable: true,
    render: (cj) => (
      <Badge
        variant="outline"
        className={cn(
          cj.suspend
            ? "bg-yellow-500/10 text-yellow-500"
            : "bg-green-500/10 text-green-500"
        )}
      >
        {cj.suspend ? "True" : "False"}
      </Badge>
    ),
  },
  {
    key: "active_jobs",
    label: "ACTIVE",
    sortable: true,
    render: (cj) => cj.active_jobs,
  },
  {
    key: "last_schedule_time",
    label: "LAST SCHEDULE",
    sortable: true,
    render: (cj) => (cj.last_schedule_time ? formatAge(cj.last_schedule_time) : "-"),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (cj) => (cj.created_at ? formatAge(cj.created_at) : "-"),
  },
];

// Networking Resources

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

// Configuration Resources

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

// =============================================================================
// Storage Resource Columns
// =============================================================================

export const pvColumns: Column<PVInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (pv) => <span className="font-medium">{pv.name}</span>,
  },
  {
    key: "capacity",
    label: "CAPACITY",
    sortable: true,
    render: (pv) => pv.capacity || "-",
  },
  {
    key: "access_modes",
    label: "ACCESS MODES",
    sortable: false,
    render: (pv) => pv.access_modes.join(", ") || "-",
  },
  {
    key: "reclaim_policy",
    label: "RECLAIM POLICY",
    sortable: true,
    render: (pv) => pv.reclaim_policy || "-",
  },
  {
    key: "status",
    label: "STATUS",
    sortable: true,
    render: (pv) => <PVStatusBadge status={pv.status} />,
  },
  {
    key: "claim",
    label: "CLAIM",
    sortable: true,
    render: (pv) => pv.claim_name ? `${pv.claim_namespace}/${pv.claim_name}` : "-",
  },
  {
    key: "storage_class_name",
    label: "STORAGE CLASS",
    sortable: true,
    render: (pv) => pv.storage_class_name || "-",
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (pv) => (pv.created_at ? formatAge(pv.created_at) : "-"),
  },
];

export const pvcColumns: Column<PVCInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (pvc) => <span className="font-medium">{pvc.name}</span>,
  },
  {
    key: "namespace",
    label: "NAMESPACE",
    sortable: true,
    render: (pvc) => (
      <div className="flex items-center gap-2">
        <NamespaceColorDot namespace={pvc.namespace} />
        <span>{pvc.namespace}</span>
      </div>
    ),
  },
  {
    key: "status",
    label: "STATUS",
    sortable: true,
    render: (pvc) => <PVCStatusBadge status={pvc.status} />,
  },
  {
    key: "volume_name",
    label: "VOLUME",
    sortable: true,
    render: (pvc) => pvc.volume_name || "-",
  },
  {
    key: "capacity",
    label: "CAPACITY",
    sortable: true,
    render: (pvc) => pvc.capacity || pvc.requested_storage || "-",
  },
  {
    key: "access_modes",
    label: "ACCESS MODES",
    sortable: false,
    render: (pvc) => pvc.access_modes.join(", ") || "-",
  },
  {
    key: "storage_class_name",
    label: "STORAGE CLASS",
    sortable: true,
    render: (pvc) => pvc.storage_class_name || "-",
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (pvc) => (pvc.created_at ? formatAge(pvc.created_at) : "-"),
  },
];

export const storageClassColumns: Column<StorageClassInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (sc) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{sc.name}</span>
        {sc.is_default && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-primary/10 text-primary border-primary/20">
            default
          </Badge>
        )}
      </div>
    ),
  },
  {
    key: "provisioner",
    label: "PROVISIONER",
    sortable: true,
    render: (sc) => <span className="text-muted-foreground text-xs font-mono">{sc.provisioner}</span>,
  },
  {
    key: "reclaim_policy",
    label: "RECLAIM POLICY",
    sortable: true,
    render: (sc) => sc.reclaim_policy || "Delete",
  },
  {
    key: "volume_binding_mode",
    label: "VOLUME BINDING MODE",
    sortable: true,
    render: (sc) => sc.volume_binding_mode || "Immediate",
  },
  {
    key: "allow_volume_expansion",
    label: "EXPANSION",
    sortable: true,
    render: (sc) => sc.allow_volume_expansion ? "Yes" : "No",
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (sc) => (sc.created_at ? formatAge(sc.created_at) : "-"),
  },
];

export const csiDriverColumns: Column<CSIDriverInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (driver) => <span className="font-medium font-mono text-xs">{driver.name}</span>,
  },
  {
    key: "attach_required",
    label: "ATTACH REQUIRED",
    sortable: true,
    render: (driver) => driver.attach_required ? "Yes" : "No",
  },
  {
    key: "pod_info_on_mount",
    label: "POD INFO",
    sortable: true,
    render: (driver) => driver.pod_info_on_mount ? "Yes" : "No",
  },
  {
    key: "storage_capacity",
    label: "STORAGE CAPACITY",
    sortable: true,
    render: (driver) => driver.storage_capacity ? "Yes" : "No",
  },
  {
    key: "volume_lifecycle_modes",
    label: "MODES",
    sortable: false,
    render: (driver) => driver.volume_lifecycle_modes.join(", ") || "-",
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (driver) => (driver.created_at ? formatAge(driver.created_at) : "-"),
  },
];

export const csiNodeColumns: Column<CSINodeInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (node) => <span className="font-medium">{node.name}</span>,
  },
  {
    key: "drivers",
    label: "DRIVERS",
    sortable: true,
    render: (node) => node.drivers.length,
  },
  {
    key: "driver_names",
    label: "DRIVER NAMES",
    sortable: false,
    render: (node) => (
      <div className="flex flex-wrap gap-1">
        {node.drivers.slice(0, 3).map((d) => (
          <Badge key={d.name} variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono">
            {d.name.split(".").pop()}
          </Badge>
        ))}
        {node.drivers.length > 3 && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
            +{node.drivers.length - 3}
          </Badge>
        )}
      </div>
    ),
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (node) => (node.created_at ? formatAge(node.created_at) : "-"),
  },
];

export const volumeAttachmentColumns: Column<VolumeAttachmentInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (va) => <span className="font-medium text-xs font-mono">{va.name.slice(0, 40)}...</span>,
  },
  {
    key: "attacher",
    label: "ATTACHER",
    sortable: true,
    render: (va) => <span className="text-xs font-mono">{va.attacher}</span>,
  },
  {
    key: "pv_name",
    label: "PV",
    sortable: true,
    render: (va) => va.pv_name || "-",
  },
  {
    key: "node_name",
    label: "NODE",
    sortable: true,
    render: (va) => va.node_name,
  },
  {
    key: "attached",
    label: "ATTACHED",
    sortable: true,
    render: (va) => <VolumeAttachmentStatusBadge attached={va.attached} />,
  },
  {
    key: "created_at",
    label: "AGE",
    sortable: true,
    render: (va) => (va.created_at ? formatAge(va.created_at) : "-"),
  },
];

// =============================================================================
// Access Control Resource Columns
// =============================================================================

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
      <Badge
        variant="outline"
        className={cn(
          "border-0",
          sa.automount_service_account_token !== false
            ? "bg-green-500/10 text-green-500"
            : "bg-muted text-muted-foreground"
        )}
      >
        {sa.automount_service_account_token !== false ? "Yes" : "No"}
      </Badge>
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
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-500/10 text-blue-500">
            aggregated
          </Badge>
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

// =============================================================================
// Administration Resource Columns
// =============================================================================

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

// Helm Release columns
export const helmReleaseColumns: Column<HelmReleaseInfo>[] = [
  {
    key: "name",
    label: "NAME",
    sortable: true,
    render: (r) => <span className="font-medium text-xs">{r.name}</span>,
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
      render: (r) => <span className="font-medium text-xs">{r.name}</span>,
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

// Helper components

function EventTypeBadge({ type }: { type: string }) {
  const isWarning = type === "Warning";
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-0",
        isWarning
          ? "bg-yellow-500/10 text-yellow-500"
          : "bg-blue-500/10 text-blue-500"
      )}
    >
      {type}
    </Badge>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    Complete: "bg-green-500/10 text-green-500",
    Running: "bg-blue-500/10 text-blue-500",
    Failed: "bg-destructive/10 text-destructive",
    Pending: "bg-yellow-500/10 text-yellow-500",
  };

  return (
    <Badge
      variant="outline"
      className={cn("border-0", variants[status] || "bg-muted text-muted-foreground")}
    >
      {status}
    </Badge>
  );
}

function HelmStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    deployed: "bg-green-500/10 text-green-500",
    superseded: "bg-muted text-muted-foreground",
    failed: "bg-destructive/10 text-destructive",
    uninstalling: "bg-yellow-500/10 text-yellow-500",
    "pending-install": "bg-blue-500/10 text-blue-500",
    "pending-upgrade": "bg-blue-500/10 text-blue-500",
    "pending-rollback": "bg-yellow-500/10 text-yellow-500",
    uninstalled: "bg-muted text-muted-foreground",
  };

  return (
    <Badge
      variant="outline"
      className={cn("border-0 text-[10px]", variants[status] || "bg-muted text-muted-foreground")}
    >
      {status}
    </Badge>
  );
}

function NamespaceColorDot({ namespace }: { namespace: string }) {
  const color = getNamespaceColor(namespace);
  return <span className={cn("size-2 rounded-full shrink-0", color.dot)} />;
}

function PVStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    Available: "bg-green-500/10 text-green-500",
    Bound: "bg-blue-500/10 text-blue-500",
    Released: "bg-yellow-500/10 text-yellow-500",
    Failed: "bg-destructive/10 text-destructive",
    Pending: "bg-yellow-500/10 text-yellow-500",
  };

  return (
    <Badge
      variant="outline"
      className={cn("border-0", variants[status] || "bg-muted text-muted-foreground")}
    >
      {status}
    </Badge>
  );
}

function PVCStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    Bound: "bg-green-500/10 text-green-500",
    Pending: "bg-yellow-500/10 text-yellow-500",
    Lost: "bg-destructive/10 text-destructive",
  };

  return (
    <Badge
      variant="outline"
      className={cn("border-0", variants[status] || "bg-muted text-muted-foreground")}
    >
      {status}
    </Badge>
  );
}

function VolumeAttachmentStatusBadge({ attached }: { attached: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-0",
        attached ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
      )}
    >
      {attached ? "Attached" : "Pending"}
    </Badge>
  );
}

function PodPhaseBadge({ phase }: { phase: string }) {
  const variants: Record<string, string> = {
    Running: "bg-green-500/10 text-green-500",
    Pending: "bg-yellow-500/10 text-yellow-500",
    Succeeded: "bg-blue-500/10 text-blue-500",
    Failed: "bg-destructive/10 text-destructive",
    Terminating: "bg-muted text-muted-foreground",
    Unknown: "bg-muted text-muted-foreground",
  };

  return (
    <Badge
      variant="outline"
      className={cn("border-0", variants[phase] || variants.Unknown)}
    >
      {phase}
    </Badge>
  );
}

function formatAge(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMins > 0) return `${diffMins}m`;
  return `${diffSecs}s`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h${mins}m`;
  if (mins > 0) return `${mins}m${secs}s`;
  return `${secs}s`;
}
