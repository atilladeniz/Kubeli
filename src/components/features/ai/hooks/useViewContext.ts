"use client";

import { useMemo } from "react";
import { useTabsStore } from "@/lib/stores/tabs-store";
import { useLogStore } from "@/lib/stores/log-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useResourceDetail } from "@/components/features/dashboard/context/ResourceDetailContext";
import type { ResourceType } from "@/components/layout/sidebar/types/types";

export interface ViewContext {
  activeView: ResourceType;
  activeViewTitle: string;
  logContext?: {
    namespace: string;
    podName: string;
    container: string | null;
    isStreaming: boolean;
    logLineCount: number;
  };
  selectedResource?: {
    type: string;
    name: string;
    namespace?: string;
  };
  selectedNamespaces: string[];
}

export function useViewContext(): ViewContext {
  const { tabs, activeTabId } = useTabsStore();
  const { logTabs } = useLogStore();
  const { selectedNamespaces } = useClusterStore();

  let selectedResource: ViewContext["selectedResource"] | undefined;
  try {
    const detail = useResourceDetail();
    if (detail.selectedResource) {
      const { data, type } = detail.selectedResource;
      selectedResource = {
        type,
        name: (data as { name?: string }).name ?? "",
        namespace: (data as { namespace?: string }).namespace,
      };
    }
  } catch {
    // Not inside ResourceDetailProvider — no selected resource
  }

  return useMemo(() => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const activeView: ResourceType = activeTab?.type ?? "cluster-overview";
    const activeViewTitle = activeTab?.title ?? "";

    let logContext: ViewContext["logContext"] | undefined;
    if (activeView === "pod-logs" && activeTab?.metadata) {
      const { namespace, podName } = activeTab.metadata;
      const logState = logTabs[activeTabId];
      if (namespace && podName) {
        logContext = {
          namespace,
          podName,
          container: logState?.selectedContainer ?? null,
          isStreaming: logState?.isStreaming ?? false,
          logLineCount: logState?.logs.length ?? 0,
        };
      }
    }

    return {
      activeView,
      activeViewTitle,
      logContext,
      selectedResource,
      selectedNamespaces,
    };
  }, [tabs, activeTabId, logTabs, selectedResource, selectedNamespaces]);
}
