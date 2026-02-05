"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useLogStore } from "../stores/log-store";
import { useTabsStore } from "../stores/tabs-store";
import { downloadPodLogs } from "../tauri/commands";
import type { LogEntry, LogOptions } from "../types";

export interface UseLogsReturn {
  logs: LogEntry[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  containers: string[];
  selectedContainer: string | null;
  setSelectedContainer: (container: string | null) => void;
  fetchLogs: (options: Omit<LogOptions, "namespace" | "pod_name">) => Promise<void>;
  startStream: (options?: Omit<LogOptions, "namespace" | "pod_name">) => Promise<void>;
  stopStream: () => Promise<void>;
  clearLogs: () => void;
  downloadLogs: () => Promise<string>;
  searchLogs: (query: string) => LogEntry[];
}

export function useLogs(
  namespace: string,
  podName: string,
  overrideTabId?: string,
): UseLogsReturn {
  const storeTabId = useTabsStore((s) => s.activeTabId);
  const tabId = overrideTabId ?? storeTabId;
  const tab = useLogStore((s) => s.logTabs[tabId]);
  const store = useLogStore.getState;

  // Init log tab on mount (no-op on re-mount), stop stream on unmount
  useEffect(() => {
    if (!namespace || !podName) return;
    store().initLogTab(tabId, namespace, podName);

    return () => {
      if (overrideTabId) {
        // Detail pane: full cleanup since tab ID is ephemeral
        store().cleanupLogTab(tabId);
      } else {
        // Regular tab: keep logs in store, just stop streaming
        store().stopStream(tabId);
      }
    };
  }, [tabId, namespace, podName, store, overrideTabId]);

  const error = tab?.error ?? null;

  const selectedContainer = tab?.selectedContainer ?? null;

  const setSelectedContainer = useCallback(
    (container: string | null) => {
      const s = store();
      s.setSelectedContainer(tabId, container);
      // Stop current stream, clear logs, restart with new container
      s.stopStream(tabId).then(() => {
        s.clearLogs(tabId);
      });
    },
    [tabId, store]
  );

  const fetchLogs = useCallback(
    async (fetchOptions: Omit<LogOptions, "namespace" | "pod_name"> = {}) => {
      await store().fetchLogs(tabId, namespace, podName, fetchOptions);
    },
    [tabId, namespace, podName, store]
  );

  const startStream = useCallback(
    async (streamOptions: Omit<LogOptions, "namespace" | "pod_name"> = {}) => {
      await store().startStream(
        tabId,
        namespace,
        podName,
        undefined,
        streamOptions.tail_lines
      );
    },
    [tabId, namespace, podName, store]
  );

  const stopStream = useCallback(async () => {
    await store().stopStream(tabId);
  }, [tabId, store]);

  const clearLogs = useCallback(() => {
    store().clearLogs(tabId);
  }, [tabId, store]);

  const downloadLogs = useCallback(async (): Promise<string> => {
    if (!namespace || !podName) {
      throw new Error("No pod selected");
    }
    const logOptions: LogOptions = {
      namespace,
      pod_name: podName,
      container: selectedContainer || undefined,
      timestamps: true,
    };
    return downloadPodLogs(logOptions);
  }, [namespace, podName, selectedContainer]);

  const logs = useMemo(() => tab?.logs ?? [], [tab?.logs]);
  const searchLogs = useCallback(
    (query: string): LogEntry[] => {
      if (!query) return logs;
      const lowerQuery = query.toLowerCase();
      return logs.filter((log) => log.message.toLowerCase().includes(lowerQuery));
    },
    [logs]
  );

  return {
    logs,
    isLoading: tab?.isLoading ?? false,
    isStreaming: tab?.isStreaming ?? false,
    error,
    containers: tab?.containers ?? [],
    selectedContainer,
    setSelectedContainer,
    fetchLogs,
    startStream,
    stopStream,
    clearLogs,
    downloadLogs,
    searchLogs,
  };
}
