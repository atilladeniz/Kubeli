"use client";

import { useState, useMemo } from "react";
import { usePlatform } from "@/lib/hooks/usePlatform";
import { useTranslations } from "next-intl";

import {
  ChevronRight,
  Layers,
  Box,
  Globe,
  Settings,
  Database,
  Shield,
  Wrench,
  Package,
  Cog,
  ArrowRightLeft,
  X,
  ExternalLink,
  Maximize2,
  Star,
  Clock,
  Trash2,
  MoreHorizontal,
  FileText,
  Eye,
  Check,
  ChevronsUpDown,
  GitBranch,
} from "lucide-react";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { ClusterIcon } from "@/components/ui/cluster-icon";
import { useUIStore } from "@/lib/stores/ui-store";
import { usePortForward } from "@/lib/hooks/usePortForward";
import {
  useFavoritesStore,
  type FavoriteResource,
} from "@/lib/stores/favorites-store";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getNamespaceColor } from "@/lib/utils/colors";
import { Kbd } from "@/components/ui/kbd";

export type ResourceType =
  // Cluster
  | "cluster-overview"
  | "resource-diagram"
  | "nodes"
  | "events"
  | "namespaces"
  | "leases"
  // Helm
  | "helm-releases"
  // Flux
  | "flux-kustomizations"
  // Workloads
  | "workloads-overview"
  | "deployments"
  | "pods"
  | "replicasets"
  | "daemonsets"
  | "statefulsets"
  | "jobs"
  | "cronjobs"
  // Networking
  | "port-forwards"
  | "services"
  | "ingresses"
  | "endpoint-slices"
  | "network-policies"
  | "ingress-classes"
  // Configuration
  | "secrets"
  | "configmaps"
  | "hpa"
  | "limit-ranges"
  | "resource-quotas"
  | "pod-disruption-budgets"
  // Storage
  | "persistent-volumes"
  | "persistent-volume-claims"
  | "volume-attachments"
  | "storage-classes"
  | "csi-drivers"
  | "csi-nodes"
  // Access Control
  | "service-accounts"
  | "roles"
  | "role-bindings"
  | "cluster-roles"
  | "cluster-role-bindings"
  // Administration
  | "crds"
  | "priority-classes"
  | "runtime-classes"
  | "mutating-webhooks"
  | "validating-webhooks"
  // Special views
  | "pod-logs";

interface NavItem {
  id: ResourceType;
  label: string;
}

interface NavSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: NavItem[];
}

// Views that are implemented (not "coming soon")
const implementedViews: ResourceType[] = [
  "cluster-overview",
  "resource-diagram",
  "nodes",
  "namespaces",
  "events",
  "leases",
  "workloads-overview",
  "pods",
  "deployments",
  "replicasets",
  "daemonsets",
  "statefulsets",
  "jobs",
  "cronjobs",
  "port-forwards",
  "services",
  "ingresses",
  "endpoint-slices",
  "network-policies",
  "ingress-classes",
  "configmaps",
  "secrets",
  "hpa",
  "limit-ranges",
  "resource-quotas",
  "pod-disruption-budgets",
  "persistent-volumes",
  "persistent-volume-claims",
  "storage-classes",
  "csi-drivers",
  "csi-nodes",
  "volume-attachments",
  "service-accounts",
  "roles",
  "role-bindings",
  "cluster-roles",
  "cluster-role-bindings",
  "crds",
  "priority-classes",
  "runtime-classes",
  "mutating-webhooks",
  "validating-webhooks",
  "helm-releases",
  "flux-kustomizations",
];

// Hook to get translated navigation sections
function useNavigationSections(): NavSection[] {
  const t = useTranslations("navigation");

  return useMemo(() => [
    {
      id: "cluster",
      title: t("cluster"),
      icon: <Layers className="size-4" />,
      items: [
        { id: "cluster-overview", label: t("overview") },
        { id: "resource-diagram", label: t("resourceDiagram") },
        { id: "nodes", label: t("nodes") },
        { id: "events", label: t("events") },
        { id: "namespaces", label: t("namespaces") },
        { id: "leases", label: t("leases") },
      ],
    },
    {
      id: "helm",
      title: t("helm"),
      icon: <Package className="size-4" />,
      items: [{ id: "helm-releases", label: t("releases") }],
    },
    {
      id: "flux",
      title: "Flux",
      icon: <GitBranch className="size-4" />,
      items: [{ id: "flux-kustomizations", label: "Kustomizations" }],
    },
    {
      id: "workloads",
      title: t("workloads"),
      icon: <Box className="size-4" />,
      items: [
        { id: "workloads-overview", label: t("overview") },
        { id: "deployments", label: t("deployments") },
        { id: "pods", label: t("pods") },
        { id: "replicasets", label: t("replicaSets") },
        { id: "daemonsets", label: t("daemonSets") },
        { id: "statefulsets", label: t("statefulSets") },
        { id: "jobs", label: t("jobs") },
        { id: "cronjobs", label: t("cronJobs") },
      ],
    },
    {
      id: "networking",
      title: t("networking"),
      icon: <Globe className="size-4" />,
      items: [
        { id: "port-forwards", label: t("portForwards") },
        { id: "services", label: t("services") },
        { id: "ingresses", label: t("ingresses") },
        { id: "endpoint-slices", label: t("endpointSlices") },
        { id: "network-policies", label: t("networkPolicies") },
        { id: "ingress-classes", label: t("ingressClasses") },
      ],
    },
    {
      id: "configuration",
      title: t("configuration"),
      icon: <Settings className="size-4" />,
      items: [
        { id: "secrets", label: t("secrets") },
        { id: "configmaps", label: t("configMaps") },
        { id: "hpa", label: t("hpa") },
        { id: "limit-ranges", label: t("limitRanges") },
        { id: "resource-quotas", label: t("resourceQuotas") },
        { id: "pod-disruption-budgets", label: t("podDisruptionBudgets") },
      ],
    },
    {
      id: "storage",
      title: t("storage"),
      icon: <Database className="size-4" />,
      items: [
        { id: "persistent-volumes", label: t("persistentVolumes") },
        { id: "persistent-volume-claims", label: t("persistentVolumeClaims") },
        { id: "volume-attachments", label: t("volumeAttachments") },
        { id: "storage-classes", label: t("storageClasses") },
        { id: "csi-drivers", label: t("csiDrivers") },
        { id: "csi-nodes", label: t("csiNodes") },
      ],
    },
    {
      id: "access-control",
      title: t("accessControl"),
      icon: <Shield className="size-4" />,
      items: [
        { id: "service-accounts", label: t("serviceAccounts") },
        { id: "roles", label: t("roles") },
        { id: "role-bindings", label: t("roleBindings") },
        { id: "cluster-roles", label: t("clusterRoles") },
        { id: "cluster-role-bindings", label: t("clusterRoleBindings") },
      ],
    },
    {
      id: "administration",
      title: t("administration"),
      icon: <Wrench className="size-4" />,
      items: [
        { id: "crds", label: t("crds") },
        { id: "priority-classes", label: t("priorityClasses") },
        { id: "runtime-classes", label: t("runtimeClasses") },
        { id: "mutating-webhooks", label: t("mutatingWebhooks") },
        { id: "validating-webhooks", label: t("validatingWebhooks") },
      ],
    },
  ], [t]);
}

interface SidebarProps {
  activeResource: ResourceType;
  onResourceSelect: (resource: ResourceType) => void;
  onResourceSelectNewTab?: (resource: ResourceType, title: string) => void;
  onFavoriteSelect?: (favorite: FavoriteResource) => void | Promise<void>;
  onFavoriteOpenLogs?: (favorite: FavoriteResource) => void | Promise<void>;
}

export function Sidebar({
  activeResource,
  onResourceSelect,
  onResourceSelectNewTab,
  onFavoriteSelect,
  onFavoriteOpenLogs,
}: SidebarProps) {
  const t = useTranslations();
  const tNav = useTranslations("navigation");
  const tCluster = useTranslations("cluster");

  const {
    currentCluster,
    currentNamespace,
    namespaces,
    setCurrentNamespace,
    isConnected,
    disconnect,
    latencyMs,
    isReconnecting,
    reconnectAttempts,
    isHealthy,
  } = useClusterStore();

  const { setSettingsOpen } = useUIStore();
  const { forwards, stopForward } = usePortForward();
  const { getFavorites, removeFavorite, getRecentResources } =
    useFavoritesStore();
  const [namespaceOpen, setNamespaceOpen] = useState(false);
  const navigationSections = useNavigationSections();
  const { modKeySymbol } = usePlatform();

  const clusterContext = currentCluster?.context || "";
  const favorites = getFavorites(clusterContext);
  const recentResources = getRecentResources(clusterContext).slice(0, 5);
  const handleOpenForwardInBrowser = async (port: number) => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(`http://localhost:${port}`);
    } catch (err) {
      console.error("Failed to open browser:", err);
      window.open(`http://localhost:${port}`, "_blank");
    }
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card/50 overflow-hidden">
      {/* Traffic lights safe area */}
      <div data-tauri-drag-region className="h-8 shrink-0" />

      {/* Cluster Context - Clickable to disconnect */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={disconnect}
              className="mx-3 mb-3 flex w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border border-border/70 bg-muted/50 px-3 py-2 text-left transition-colors hover:border-border hover:bg-muted"
            >
              {currentCluster ? (
                <ClusterIcon cluster={currentCluster} size={20} />
              ) : (
                <Layers className="size-5 text-primary" />
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">
                  {currentCluster?.name || tCluster("noCluster")}
                </p>
              </div>
              {isConnected && isHealthy && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {latencyMs !== null && (
                    <span className="text-[10px] text-muted-foreground">
                      {latencyMs}ms
                    </span>
                  )}
                  <span className="size-2 rounded-full bg-green-400" />
                </div>
              )}
              {isConnected && !isHealthy && !isReconnecting && (
                <span className="size-2 shrink-0 rounded-full bg-yellow-400" />
              )}
              {isReconnecting && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    Retry {reconnectAttempts}
                  </span>
                  <span className="size-2 rounded-full bg-yellow-400 animate-pulse" />
                </div>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>
              {isReconnecting
                ? `Reconnecting (attempt ${reconnectAttempts})...`
                : isConnected && !isHealthy
                ? "Connection unhealthy"
                : isConnected
                ? `Connected${latencyMs ? ` (${latencyMs}ms)` : ""}`
                : "Click to switch cluster"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Separator />

      {/* Port Forwards */}
      {isConnected && forwards.length > 0 && (
        <>
          <div className="p-3 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => onResourceSelect("port-forwards")}
                className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <ArrowRightLeft className="size-3" />
                {tNav("portForwards")}
                <Maximize2 className="size-2.5" />
              </button>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {forwards.length}
              </Badge>
            </div>
            <div
              className={cn(
                "space-y-1",
                forwards.length > 3 && "max-h-[132px] overflow-y-auto pr-1"
              )}
            >
              {forwards.map((forward) => (
                <div
                  key={forward.forward_id}
                  className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-xs group overflow-hidden"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0",
                        forward.status === "connected"
                          ? "bg-green-400"
                          : forward.status === "connecting"
                          ? "bg-yellow-400 animate-pulse"
                          : "bg-red-400"
                      )}
                    />
                    <span className="truncate font-medium max-w-[80px]">
                      {forward.name}
                    </span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      :{forward.local_port}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 ml-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-5 p-0 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleOpenForwardInBrowser(forward.local_port);
                      }}
                      aria-label={`Open localhost:${forward.local_port}`}
                    >
                      <ExternalLink className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-5 p-0 rounded hover:bg-background text-muted-foreground hover:text-destructive"
                      onClick={() => stopForward(forward.forward_id)}
                      aria-label={`Stop ${forward.name} port forward`}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Namespace Selector */}
      {isConnected && namespaces.length > 0 && (
        <>
          <div className="p-3">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {tCluster("namespace")}
            </label>
            <Popover open={namespaceOpen} onOpenChange={setNamespaceOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={namespaceOpen}
                  className="w-full justify-between"
                >
                  {currentNamespace ? (
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "size-2 rounded-full shrink-0",
                          getNamespaceColor(currentNamespace).dot
                        )}
                      />
                      <span className="truncate">{currentNamespace}</span>
                    </span>
                  ) : (
                    tCluster("allNamespaces")
                  )}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="min-w-(--radix-popover-trigger-width) p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder={`${t("common.search")}...`} />
                  <CommandList>
                    <CommandEmpty>{t("common.noData")}</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={(value) => {
                          setCurrentNamespace(value === "all" ? "" : value);
                          setNamespaceOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            currentNamespace ? "opacity-0" : "opacity-100"
                          )}
                        />
                        {tCluster("allNamespaces")}
                      </CommandItem>
                      {namespaces.map((ns) => {
                        const color = getNamespaceColor(ns);
                        return (
                          <CommandItem
                            key={ns}
                            value={ns}
                            onSelect={(value) => {
                              setCurrentNamespace(value);
                              setNamespaceOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 size-4",
                                currentNamespace === ns
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "size-2 rounded-full shrink-0",
                                  color.dot
                                )}
                              />
                              <span>{ns}</span>
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <Separator />
        </>
      )}

      {/* Favorites */}
      {isConnected && favorites.length > 0 && (
        <>
          <div className="p-3 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Star className="size-3 fill-yellow-500 text-yellow-500" />
                {tNav("favorites")}
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {favorites.length}
              </Badge>
            </div>
            <div
              className={cn(
                "space-y-1",
                favorites.length > 4 && "max-h-[176px] overflow-y-auto pr-1"
              )}
            >
              {favorites.map((fav, index) => (
                <FavoriteItem
                  key={fav.id}
                  favorite={fav}
                  index={index}
                  onSelect={() => {
                    if (onFavoriteSelect) {
                      void onFavoriteSelect(fav);
                      return;
                    }
                    onResourceSelect(fav.resourceType as ResourceType);
                  }}
                  onRemove={() => removeFavorite(clusterContext, fav.id)}
                  onOpenLogs={
                    onFavoriteOpenLogs
                      ? () => onFavoriteOpenLogs(fav)
                      : undefined
                  }
                  modKey={modKeySymbol}
                />
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Recent Resources */}
      {isConnected && recentResources.length > 0 && (
        <>
          <div className="p-3 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3" />
                {tNav("recent")}
              </span>
            </div>
            <div className="space-y-1">
              {recentResources.map((recent) => (
                <button
                  key={`${recent.resourceType}-${recent.name}-${
                    recent.namespace || ""
                  }`}
                  onClick={() =>
                    onResourceSelect(recent.resourceType as ResourceType)
                  }
                  className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <span className="truncate font-medium">{recent.name}</span>
                  {recent.namespace && (
                    <span className="text-[10px] text-muted-foreground/60 truncate">
                      {recent.namespace}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0">
        <nav className="p-2 pr-3 pb-4">
          {navigationSections.map((section) => (
            <NavSectionCollapsible
              key={section.id}
              section={section}
              activeResource={activeResource}
              onResourceSelect={onResourceSelect}
              onResourceSelectNewTab={onResourceSelectNewTab}
              defaultOpen={
                section.id === "cluster" ||
                section.id === "workloads" ||
                section.id === "networking"
              }
              soonLabel={tNav("soon")}
            />
          ))}
        </nav>
      </ScrollArea>

      {/* Settings Button */}
      <Separator />
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSettingsOpen(true)}
          className="w-full justify-between px-2 text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Cog className="size-4" />
            {tNav("settings")}
          </span>
          <Kbd className="text-[10px]">{modKeySymbol},</Kbd>
        </Button>
      </div>
    </aside>
  );
}

interface NavSectionCollapsibleProps {
  section: NavSection;
  activeResource: ResourceType;
  onResourceSelect: (resource: ResourceType) => void;
  onResourceSelectNewTab?: (resource: ResourceType, title: string) => void;
  defaultOpen?: boolean;
  soonLabel: string;
}

function NavSectionCollapsible({
  section,
  activeResource,
  onResourceSelect,
  onResourceSelectNewTab,
  defaultOpen = false,
  soonLabel,
}: NavSectionCollapsibleProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="mb-1">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 px-2 font-medium text-muted-foreground hover:text-foreground [&[data-state=open]>svg.chevron]:rotate-90"
        >
          {section.icon}
          <span className="flex-1 text-left">{section.title}</span>
          <ChevronRight className="chevron size-3.5 transition-transform" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-4 mt-0.5 space-y-0.5">
        {section.items.map((item) => {
          const isImplemented = implementedViews.includes(item.id);
          return (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              onClick={(e) => {
                if (!isImplemented) return;
                if ((e.metaKey || e.ctrlKey) && onResourceSelectNewTab) {
                  onResourceSelectNewTab(item.id, item.label);
                } else {
                  onResourceSelect(item.id);
                }
              }}
              disabled={!isImplemented}
              className={cn(
                "w-full justify-between px-2 font-normal",
                activeResource === item.id
                  ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                  : isImplemented
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-muted-foreground/50 cursor-not-allowed"
              )}
            >
              <span>{item.label}</span>
              {!isImplemented && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 h-4 font-normal opacity-60"
                >
                  {soonLabel}
                </Badge>
              )}
            </Button>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Favorite item with keyboard shortcut indicator
interface FavoriteItemProps {
  favorite: FavoriteResource;
  index: number;
  onSelect: () => void;
  onRemove: () => void;
  onOpenLogs?: () => void | Promise<void>;
  modKey: string;
}

function FavoriteItem({
  favorite,
  index,
  onSelect,
  onRemove,
  onOpenLogs,
  modKey,
}: FavoriteItemProps) {
  const t = useTranslations();
  const shortcutKey = index < 9 ? index + 1 : null;
  const canOpenLogs = favorite.resourceType === "pods" && !!favorite.namespace;

  return (
    <div className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-xs group overflow-hidden">
      <button
        onClick={onSelect}
        className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden text-left hover:text-foreground transition-colors"
      >
        <Star className="size-3 shrink-0 fill-yellow-500 text-yellow-500" />
        <span className="truncate font-medium">{favorite.name}</span>
        {favorite.namespace && (
          <span className="text-muted-foreground/60 truncate text-[10px]">
            {favorite.namespace}
          </span>
        )}
      </button>
      <div className="flex items-center gap-1 shrink-0 ml-1">
        {shortcutKey && (
          <Kbd className="text-[9px] opacity-50 group-hover:opacity-100 transition-opacity">
            {modKey}{shortcutKey}
          </Kbd>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={t("common.actions")}
              className="p-1 rounded hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="size-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSelect()}>
              <Eye className="size-4" />
              {t("favorites.openDetails")}
            </DropdownMenuItem>
            {canOpenLogs && onOpenLogs && (
              <DropdownMenuItem onClick={() => onOpenLogs()}>
                <FileText className="size-4" />
                {t("favorites.openLogs")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onRemove()}>
              <Trash2 className="size-4" />
              {t("favorites.remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
