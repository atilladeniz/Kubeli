"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { AlertCircle, Info } from "lucide-react";
import { useLogs } from "@/lib/hooks/useLogs";
import { useLogStore } from "@/lib/stores/log-store";
import { useTabsStore } from "@/lib/stores/tabs-store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslations } from "next-intl";
import { LogHeader, LogToolbar, LogContent, LogFooter } from "./components";
import { useLogFilter, useLogAnalysis, useLogDownload, useAutoScroll } from "./hooks";
import { LOG_DEFAULTS } from "./types";

interface LogViewerProps {
  namespace: string;
  podName: string;
  initialContainer?: string;
  onClose?: () => void;
}

/**
 * Log viewer component for Kubernetes pods.
 * Supports streaming, filtering, searching, and AI analysis.
 */
export function LogViewer({ namespace, podName, initialContainer }: LogViewerProps) {
  const t = useTranslations();

  // Core log state from hook
  const {
    logs,
    isLoading,
    isStreaming,
    error,
    containers,
    selectedContainer,
    setSelectedContainer,
    fetchLogs,
    startStream,
    stopStream,
    clearLogs,
  } = useLogs(namespace, podName);

  const isPodNotFound = useMemo(
    () => !!error && (error.includes("NotFound") || error.includes("not found")),
    [error]
  );

  // Local UI state
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [showPreviousLogs, setShowPreviousLogs] = useState(false);

  // Stop streaming when switching to previous logs (previous logs are static)
  useEffect(() => {
    if (showPreviousLogs && isStreaming) {
      stopStream();
    }
  }, [showPreviousLogs, isStreaming, stopStream]);

  // Filter hook
  const {
    searchQuery,
    setSearchQuery,
    useRegex,
    setUseRegex,
    logLevel,
    setLogLevel,
    regexError,
    searchRegex,
    filteredLogs,
    resetFilters,
  } = useLogFilter({ logs });

  // Reset filters when pod changes
  useEffect(() => {
    resetFilters();
  }, [namespace, podName, resetFilters]);

  // Scroll position persistence
  const tabId = useTabsStore((s) => s.activeTabId);
  const storedScrollTop = useLogStore((s) => s.logTabs[tabId]?.scrollTop ?? 0);
  const storedAutoScroll = useLogStore((s) => s.logTabs[tabId]?.autoScroll ?? true);
  const onScrollTopChange = useCallback(
    (scrollTop: number) => useLogStore.getState().setScrollTop(tabId, scrollTop),
    [tabId]
  );
  const onAutoScrollChange = useCallback(
    (value: boolean) => useLogStore.getState().setAutoScroll(tabId, value),
    [tabId]
  );

  // Auto-scroll hook - handles all scroll logic
  const isResuming = logs.length > 0;
  const { containerRef, endRef, autoScroll, scrollToBottom, handleScroll } = useAutoScroll({
    dependencies: [logs],
    initialScrollTop: storedScrollTop,
    initialAutoScroll: isResuming ? storedAutoScroll : true,
    isResuming,
    onScrollTopChange,
    onAutoScrollChange,
  });

  // AI analysis hook
  const { isAICliAvailable, analyzeWithAI } = useLogAnalysis({
    namespace,
    podName,
    container: selectedContainer,
    logs,
    t,
  });

  // Download hook
  const { isDownloading, downloadLogs } = useLogDownload({
    podName,
    container: selectedContainer,
    logs,
    filteredLogs,
    t,
  });

  // Set initial container
  useEffect(() => {
    if (initialContainer && containers.includes(initialContainer)) {
      setSelectedContainer(initialContainer);
    }
  }, [initialContainer, containers, setSelectedContainer]);

  return (
    <div className="relative flex h-full flex-col bg-background">
      <LogHeader
        title={t("logs.title")}
        podName={podName}
        namespace={namespace}
        isStreaming={isStreaming}
        streamingLabel={t("logs.streamingActive")}
        containers={containers}
        selectedContainer={selectedContainer}
        onContainerChange={setSelectedContainer}
        containerPlaceholder={t("terminal.selectContainer")}
      />

      <LogToolbar
        search={{
          query: searchQuery,
          onChange: setSearchQuery,
          useRegex,
          onRegexToggle: () => setUseRegex(!useRegex),
          regexError,
          placeholder: `${t("common.search")}...`,
          enableRegexTooltip: t("logs.enableRegex"),
          disableRegexTooltip: t("logs.disableRegex"),
        }}
        filter={{
          logLevel,
          onLogLevelChange: setLogLevel,
          logLevelLabels: {
            all: t("logs.levelAll"),
            error: t("logs.levelError"),
            warn: t("logs.levelWarn"),
            info: t("logs.levelInfo"),
            debug: t("logs.levelDebug"),
          },
          showTimestamps,
          onTimestampsToggle: setShowTimestamps,
          timestampsLabel: t("logs.timestamps"),
          showPreviousLogs,
          onPreviousLogsToggle: setShowPreviousLogs,
          previousLogsLabel: t("podDetail.previousLogs"),
          isStreaming,
        }}
        stream={{
          isStreaming,
          isLoading,
          disabled: isPodNotFound || showPreviousLogs,
          onStart: () => startStream(),
          onStop: stopStream,
          onFetch: () => fetchLogs({ tail_lines: LOG_DEFAULTS.FETCH_TAIL_LINES, previous: showPreviousLogs }),
          followLabel: t("logs.follow"),
          pausedLabel: t("logs.streamingPaused"),
          fetchTooltip: showPreviousLogs ? t("logs.previousLogsNoStream") : t("logs.fetchLogs"),
        }}
        download={{
          isDownloading,
          logsCount: logs.length,
          onDownload: downloadLogs,
        }}
        ai={{
          isAvailable: isAICliAvailable,
          onAnalyze: analyzeWithAI,
          tooltip: t("logs.analyzeWithAI"),
          unavailableTooltip: t("logs.aiUnavailable"),
        }}
        onClear={clearLogs}
        clearLabel={t("logs.clear")}
        hideClear={isPodNotFound}
      />

      {/* Error display */}
      {error && !isPodNotFound && (
        <div className="px-4 py-2">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Pod deleted banner - shown when logs exist */}
      {isPodNotFound && logs.length > 0 && (
        <div className="px-4 py-2">
          <Alert variant="info">
            <Info className="size-4" />
            <AlertDescription>{t("logs.podDeleted")}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Logs container */}
      <LogContent
        ref={containerRef}
        logs={filteredLogs}
        isLoading={isLoading}
        searchQuery={searchQuery}
        showTimestamps={showTimestamps}
        useRegex={useRegex}
        searchRegex={searchRegex}
        onScroll={handleScroll}
        onStartStream={() => startStream()}
        endRef={endRef}
        loadingText={t("common.loading")}
        searchingText={t("logs.searching")}
        noLogsText={t("logs.noLogs")}
        followText={t("logs.follow")}
      />

      <LogFooter
        filteredCount={filteredLogs.length}
        totalCount={logs.length}
        isFiltered={!!searchQuery}
        showScrollButton={!autoScroll && logs.length > 0}
        onScrollToBottom={scrollToBottom}
        autoScrollLabel={t("logs.autoScroll")}
      />
    </div>
  );
}
