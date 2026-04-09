"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AlertCircle, Info } from "lucide-react";
import { useLogs } from "@/lib/hooks/useLogs";
import { useLogStore } from "@/lib/stores/log-store";
import { useTabsStore } from "@/lib/stores/tabs-store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslations } from "next-intl";
import { LogHeader, LogToolbar, LogContent, LogFooter } from "./components";
import { useAIStore } from "@/lib/stores/ai-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useLogFilter, useLogAnalysis, useLogDownload, useAutoScroll } from "./hooks";
import { LOG_DEFAULTS } from "./types";
import type { TimestampMode } from "./types";

interface LogViewerProps {
  namespace: string;
  podName: string;
  initialContainer?: string;
  logTabId?: string;
  onClose?: () => void;
  onOpenInTab?: () => void;
}

/**
 * Log viewer component for Kubernetes pods.
 * Supports streaming, filtering, searching, and AI analysis.
 */
export function LogViewer({ namespace, podName, initialContainer, logTabId, onOpenInTab }: LogViewerProps) {
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
  } = useLogs(namespace, podName, logTabId);

  const isPodNotFound = useMemo(
    () => !!error && (error.kind === "NotFound" || error.message.includes("not found")),
    [error]
  );

  // Local UI state
  const [showPreviousLogs, setShowPreviousLogs] = useState(false);

  // Display options state
  const [lineWrap, setLineWrap] = useState(true);
  const [logColoring, setLogColoring] = useState(true);
  const [timestampMode, setTimestampMode] = useState<TimestampMode>("local");

  const showTimestamps = timestampMode !== "off";
  const timestampLocal = timestampMode === "local";

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

  // Send selected log text to AI
  const { setPendingAnalysis } = useAIStore();
  const { currentCluster, currentNamespace } = useClusterStore();
  const { setAIAssistantOpen } = useUIStore();

  const handleSendSelectionToAI = useCallback(
    (selectedText: string) => {
      if (!isAICliAvailable || !currentCluster) return;
      const message = t("logs.aiSelectionPrompt", { namespace, podName }) +
        "\n```\n" + selectedText + "\n```";
      setPendingAnalysis({
        message,
        clusterContext: currentCluster.context,
        namespace: currentNamespace || undefined,
      });
      setAIAssistantOpen(true);
    },
    [isAICliAvailable, currentCluster, currentNamespace, namespace, podName, setPendingAnalysis, setAIAssistantOpen, t]
  );

  // Copy all logs to clipboard
  const copyAllLogs = useCallback(async () => {
    try {
      const text = filteredLogs.map((l) => l.message).join("\n");
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard write may fail in some environments
    }
  }, [filteredLogs]);

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

  // Auto-follow: start streaming automatically when opened as a tab (not in detail pane)
  const hasAutoStarted = useRef(false);
  useEffect(() => {
    if (logTabId || hasAutoStarted.current || isStreaming || isLoading || isPodNotFound || showPreviousLogs) return;
    hasAutoStarted.current = true;
    startStream();
  }, [logTabId, isStreaming, isLoading, isPodNotFound, showPreviousLogs, startStream]);

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
        onOpenInTab={onOpenInTab}
        openInTabTooltip={t("logs.openInTab")}
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
          showPreviousLogs,
          onPreviousLogsToggle: setShowPreviousLogs,
          previousLogsLabel: t("podDetail.previousLogs"),
          isStreaming,
        }}
        displayOptions={{
          lineWrap,
          onLineWrapChange: setLineWrap,
          logColoring,
          onLogColoringChange: setLogColoring,
          timestampMode,
          onTimestampModeChange: setTimestampMode,
          labels: {
            tooltip: t("logs.displayOptions"),
            displayOptions: t("logs.displayOptions"),
            lineWrap: t("logs.lineWrap"),
            logColoring: t("logs.logColoring"),
            timestamp: t("logs.timestampSection"),
            timestampOff: t("logs.timestampOff"),
            timestampUtc: t("logs.timestampUtc"),
            timestampLocal: t("logs.timestampLocal"),
          },
        }}
        stream={{
          isStreaming,
          isLoading,
          disabled: isPodNotFound || showPreviousLogs,
          onStart: () => startStream(),
          onStop: stopStream,
          onFetch: () => fetchLogs({ tail_lines: LOG_DEFAULTS.FETCH_TAIL_LINES, previous: showPreviousLogs }),
          followLabel: t("logs.follow"),
          pauseLabel: t("logs.pause"),
          fetchTooltip: showPreviousLogs ? t("logs.previousLogsNoStream") : t("logs.fetchLogs"),
        }}
        download={{
          isDownloading,
          logsCount: logs.length,
          onDownload: downloadLogs,
          tooltip: t("logs.download"),
        }}
        copyAll={{
          onCopy: copyAllLogs,
          tooltip: t("logs.copyAll"),
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
            <AlertDescription>{error.message}</AlertDescription>
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
        timestampLocal={timestampLocal}
        lineWrap={lineWrap}
        logColoring={logColoring}
        useRegex={useRegex}
        searchRegex={searchRegex}
        onScroll={handleScroll}
        onStartStream={() => startStream()}
        streamDisabled={showPreviousLogs}
        endRef={endRef}
        loadingText={t("common.loading")}
        searchingText={t("logs.noMatchesFound", { query: searchQuery.length > LOG_DEFAULTS.MAX_SEARCH_DISPLAY_LENGTH ? searchQuery.slice(0, LOG_DEFAULTS.MAX_SEARCH_DISPLAY_LENGTH) + "..." : searchQuery })}
        noLogsText={t("logs.noLogs")}
        followText={t("logs.follow")}
        copyLabel={t("common.copy")}
        copiedLabel={t("common.copied")}
        onSendToAI={isAICliAvailable ? handleSendSelectionToAI : undefined}
        sendToAILabel={t("logs.sendToAI")}
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
