"use client";

import { useCallback, useRef } from "react";
import { X, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTabsStore, type Tab } from "@/lib/stores/tabs-store";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Map resource type → [sectionKey, itemKey] for i18n lookup
const RESOURCE_I18N_KEYS: Record<string, [string, string]> = {
  "cluster-overview": ["cluster", "overview"],
  "resource-diagram": ["cluster", "resourceDiagram"],
  nodes: ["cluster", "nodes"],
  events: ["cluster", "events"],
  namespaces: ["cluster", "namespaces"],
  leases: ["cluster", "leases"],
  "helm-releases": ["helm", "releases"],
  "flux-kustomizations": ["flux", "kustomizations"],
  "workloads-overview": ["workloads", "overview"],
  deployments: ["workloads", "deployments"],
  pods: ["workloads", "pods"],
  replicasets: ["workloads", "replicaSets"],
  daemonsets: ["workloads", "daemonSets"],
  statefulsets: ["workloads", "statefulSets"],
  jobs: ["workloads", "jobs"],
  cronjobs: ["workloads", "cronJobs"],
  "port-forwards": ["networking", "portForwards"],
  services: ["networking", "services"],
  ingresses: ["networking", "ingresses"],
  "endpoint-slices": ["networking", "endpointSlices"],
  "network-policies": ["networking", "networkPolicies"],
  "ingress-classes": ["networking", "ingressClasses"],
  secrets: ["configuration", "secrets"],
  configmaps: ["configuration", "configMaps"],
  hpa: ["configuration", "hpa"],
  "limit-ranges": ["configuration", "limitRanges"],
  "resource-quotas": ["configuration", "resourceQuotas"],
  "pod-disruption-budgets": ["configuration", "podDisruptionBudgets"],
  "persistent-volumes": ["storage", "persistentVolumes"],
  "persistent-volume-claims": ["storage", "persistentVolumeClaims"],
  "volume-attachments": ["storage", "volumeAttachments"],
  "storage-classes": ["storage", "storageClasses"],
  "csi-drivers": ["storage", "csiDrivers"],
  "csi-nodes": ["storage", "csiNodes"],
  "service-accounts": ["accessControl", "serviceAccounts"],
  roles: ["accessControl", "roles"],
  "role-bindings": ["accessControl", "roleBindings"],
  "cluster-roles": ["accessControl", "clusterRoles"],
  "cluster-role-bindings": ["accessControl", "clusterRoleBindings"],
  crds: ["administration", "crds"],
  "priority-classes": ["administration", "priorityClasses"],
  "runtime-classes": ["administration", "runtimeClasses"],
  "mutating-webhooks": ["administration", "mutatingWebhooks"],
  "validating-webhooks": ["administration", "validatingWebhooks"],
};

/** Build a translated tab title from resource type */
export function useTabTitle() {
  const tNav = useTranslations("navigation");

  return useCallback(
    (type: string): string => {
      const keys = RESOURCE_I18N_KEYS[type];
      if (!keys) return type;
      const [sectionKey, itemKey] = keys;
      // Some keys (e.g. flux) may not exist in navigation i18n — capitalize fallback
      const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      const section = tNav.has(sectionKey) ? tNav(sectionKey) : capitalize(sectionKey);
      const item = tNav.has(itemKey) ? tNav(itemKey) : capitalize(itemKey);
      return `${section} - ${item}`;
    },
    [tNav]
  );
}

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, closeOtherTabs, closeTabsToRight, openTab } =
    useTabsStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("tabs");
  const getTabTitle = useTabTitle();

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, tab: Tab) => {
      if (e.button === 1) {
        e.preventDefault();
        if (tabs.length > 1) {
          closeTab(tab.id);
        }
      }
    },
    [tabs.length, closeTab]
  );

  const isAtLimit = tabs.length >= 10;

  const handleAddTab = useCallback(() => {
    if (isAtLimit) return;
    openTab("cluster-overview", getTabTitle("cluster-overview"), { newTab: true });
  }, [openTab, isAtLimit, getTabTitle]);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-card/30">
      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 pr-2 flex-1 overflow-x-auto overflow-y-hidden hide-scrollbar"
      >
        {tabs.map((tab) => (
          <ContextMenu key={tab.id}>
            <ContextMenuTrigger asChild>
              <button
                onClick={() => setActiveTab(tab.id)}
                onMouseDown={(e) => handleMouseDown(e, tab)}
                className={cn(
                  "group flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md shrink-0 max-w-[200px] border transition-colors",
                  activeTabId === tab.id
                    ? "bg-muted border-border text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <span className="truncate">
                  {getTabTitle(tab.type)}
                </span>
                {tabs.length > 1 && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="shrink-0 rounded p-0.5 hover:bg-background/50 opacity-50 hover:opacity-100"
                  >
                    <X className="size-3" />
                  </span>
                )}
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                onClick={() => closeTab(tab.id)}
                disabled={tabs.length <= 1}
              >
                {t("close")}
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => closeOtherTabs(tab.id)}
                disabled={tabs.length <= 1}
              >
                {t("closeOthers")}
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => closeTabsToRight(tab.id)}
                disabled={
                  tabs.indexOf(tab) === tabs.length - 1
                }
              >
                {t("closeToRight")}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleAddTab}
              disabled={isAtLimit}
              className={cn(
                "shrink-0 rounded-md p-1.5 transition-colors",
                isAtLimit
                  ? "text-muted-foreground/30 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Plus className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{isAtLimit ? t("limitReached") : t("newTab")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
