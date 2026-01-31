"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToHorizontalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { useTabsStore, type Tab } from "@/lib/stores/tabs-store";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { usePlatform } from "@/lib/hooks/usePlatform";
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
      const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      const section = tNav.has(sectionKey) ? tNav(sectionKey) : capitalize(sectionKey);
      const item = tNav.has(itemKey) ? tNav(itemKey) : capitalize(itemKey);
      return `${section} - ${item}`;
    },
    [tNav]
  );
}

interface SortableTabProps {
  tab: Tab;
  isActive: boolean;
  canClose: boolean;
  onActivate: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseToRight: () => void;
  isLast: boolean;
  onMiddleClick: (e: React.MouseEvent) => void;
  title: string;
  tClose: string;
  tCloseOthers: string;
  tCloseToRight: string;
}

function SortableTab({
  tab,
  isActive,
  canClose,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseToRight,
  isLast,
  onMiddleClick,
  title,
  tClose,
  tCloseOthers,
  tCloseToRight,
}: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform ? { ...transform, scaleX: 1, scaleY: 1 } : null),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          ref={setNodeRef}
          style={style}
          data-tab-id={tab.id}
          {...attributes}
          {...listeners}
          onClick={onActivate}
          onMouseDown={onMiddleClick}
          className={cn(
            "group flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md shrink-0 max-w-[200px] border transition-colors select-none",
            isActive
              ? "bg-muted border-border text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
            isDragging && "shadow-lg cursor-grabbing"
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate">{title}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{title}</TooltipContent>
          </Tooltip>
          {canClose && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="shrink-0 rounded p-0.5 hover:bg-background/50 opacity-50 hover:opacity-100"
            >
              <X className="size-3" />
            </span>
          )}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onClose} disabled={!canClose}>
          {tClose}
        </ContextMenuItem>
        <ContextMenuItem onClick={onCloseOthers} disabled={!canClose}>
          {tCloseOthers}
        </ContextMenuItem>
        <ContextMenuItem onClick={onCloseToRight} disabled={isLast}>
          {tCloseToRight}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, closeOtherTabs, closeTabsToRight, openTab, reorderTabs } =
    useTabsStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("tabs");
  const getTabTitle = useTabTitle();
  const { modKeySymbol } = usePlatform();

  // Require 5px movement before drag starts — prevents accidental drags on click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setIsDragging(false);
      const { active, over } = event;
      if (over && active.id !== over.id) {
        reorderTabs(active.id as string, over.id as string);
      }
    },
    [reorderTabs]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

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
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Detect whether the tab container is overflowing
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const checkOverflow = () => {
      setIsOverflowing(el.scrollWidth > el.clientWidth);
    };

    checkOverflow();

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [tabs.length]);

  // Auto-scroll active tab fully into view (accounting for the fixed "+" button)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !activeTabId) return;

    // Delay to ensure new tab DOM element is rendered
    requestAnimationFrame(() => {
      const activeButton = el.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement | null;
      if (!activeButton) return;

      const containerRect = el.getBoundingClientRect();
      const tabRect = activeButton.getBoundingClientRect();
      const rightPadding = 8;

      if (tabRect.right + rightPadding > containerRect.right) {
        el.scrollLeft += tabRect.right - containerRect.right + rightPadding;
      }
      if (tabRect.left < containerRect.left) {
        el.scrollLeft -= containerRect.left - tabRect.left + rightPadding;
      }
    });
  }, [activeTabId, tabs.length]);

  const handleAddTab = useCallback(() => {
    if (isAtLimit) return;
    openTab("cluster-overview", getTabTitle("cluster-overview"), { newTab: true });
  }, [openTab, isAtLimit, getTabTitle]);

  const tabIds = tabs.map((t) => t.id);

  const addButton = (
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
        <TooltipContent side="bottom" className="flex items-center gap-2">
          <span>{isAtLimit ? t("limitReached") : t("newTab")}</span>
          {!isAtLimit && <Kbd className="text-[10px]">{modKeySymbol}T</Kbd>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-card/30">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setIsDragging(false)} modifiers={[restrictToHorizontalAxis, restrictToParentElement]}>
        <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
          <div
            ref={scrollRef}
            onWheel={handleWheel}
            className={cn(
              "flex items-center gap-1.5 overflow-x-auto overflow-y-hidden hide-scrollbar min-w-0 flex-1",
              isDragging && "cursor-grabbing"
            )}
          >
            {tabs.map((tab, index) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={activeTabId === tab.id}
                canClose={tabs.length > 1}
                onActivate={() => setActiveTab(tab.id)}
                onClose={() => closeTab(tab.id)}
                onCloseOthers={() => closeOtherTabs(tab.id)}
                onCloseToRight={() => closeTabsToRight(tab.id)}
                isLast={index === tabs.length - 1}
                onMiddleClick={(e) => handleMouseDown(e, tab)}
                title={tab.type === "pod-logs" ? tab.title : getTabTitle(tab.type)}
                tClose={t("close")}
                tCloseOthers={t("closeOthers")}
                tCloseToRight={t("closeToRight")}
              />
            ))}
            {!isOverflowing && addButton}
          </div>
        </SortableContext>
      </DndContext>
      {isOverflowing && (
        <div className="shrink-0 flex items-center pl-1 border-l border-border">
          {addButton}
        </div>
      )}
    </div>
  );
}
