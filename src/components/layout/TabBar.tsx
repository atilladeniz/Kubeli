"use client";

import { useCallback, useRef } from "react";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
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

// Map resource types to short display titles
export const RESOURCE_TITLES: Record<string, string> = {
  "cluster-overview": "Cluster - Overview",
  "resource-diagram": "Cluster - Diagram",
  nodes: "Cluster - Nodes",
  events: "Cluster - Events",
  namespaces: "Cluster - Namespaces",
  leases: "Cluster - Leases",
  "helm-releases": "Helm - Releases",
  "flux-kustomizations": "Flux - Kustomizations",
  "workloads-overview": "Workloads - Overview",
  deployments: "Workloads - Deployments",
  pods: "Workloads - Pods",
  replicasets: "Workloads - ReplicaSets",
  daemonsets: "Workloads - DaemonSets",
  statefulsets: "Workloads - StatefulSets",
  jobs: "Workloads - Jobs",
  cronjobs: "Workloads - CronJobs",
  "port-forwards": "Network - Port Forwards",
  services: "Network - Services",
  ingresses: "Network - Ingresses",
  "endpoint-slices": "Network - Endpoints",
  "network-policies": "Network - Policies",
  "ingress-classes": "Network - Ingress Classes",
  secrets: "Config - Secrets",
  configmaps: "Config - ConfigMaps",
  hpa: "Config - HPA",
  "limit-ranges": "Config - Limit Ranges",
  "resource-quotas": "Config - Quotas",
  "pod-disruption-budgets": "Config - PDBs",
  "persistent-volumes": "Storage - PVs",
  "persistent-volume-claims": "Storage - PVCs",
  "volume-attachments": "Storage - Vol Attachments",
  "storage-classes": "Storage - Classes",
  "csi-drivers": "Storage - CSI Drivers",
  "csi-nodes": "Storage - CSI Nodes",
  "service-accounts": "Access - Service Accounts",
  roles: "Access - Roles",
  "role-bindings": "Access - Role Bindings",
  "cluster-roles": "Access - Cluster Roles",
  "cluster-role-bindings": "Access - CRBs",
  crds: "Admin - CRDs",
  "priority-classes": "Admin - Priority Classes",
  "runtime-classes": "Admin - Runtime Classes",
  "mutating-webhooks": "Admin - Mutating WHs",
  "validating-webhooks": "Admin - Validating WHs",
};

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, closeOtherTabs, closeTabsToRight, openTab } =
    useTabsStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, tab: Tab) => {
      // Middle-click to close
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
    openTab("cluster-overview", "Cluster - Overview", { newTab: true });
  }, [openTab, isAtLimit]);

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
                  {tab.title || RESOURCE_TITLES[tab.type] || tab.type}
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
                Close
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => closeOtherTabs(tab.id)}
                disabled={tabs.length <= 1}
              >
                Close Others
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => closeTabsToRight(tab.id)}
                disabled={
                  tabs.indexOf(tab) === tabs.length - 1
                }
              >
                Close to Right
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
            <p>{isAtLimit ? "Tab-Limit erreicht (max. 10)" : "New tab"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
