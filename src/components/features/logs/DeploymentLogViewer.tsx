"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AlertCircle, Layers, Maximize2 } from "lucide-react";
import { useDeploymentLogs } from "@/lib/hooks/useDeploymentLogs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { LogToolbar, LogFooter, LogContent } from "./components";
import { useLogFilter, useAutoScroll } from "./hooks";
import { LOG_DEFAULTS } from "./types";
import type { TimestampMode } from "./types";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DeploymentLogViewerProps {
  deploymentName: string;
  namespace: string;
  onOpenInTab?: (isCurrentlyStreaming: boolean) => void;
  autoStream?: boolean;
}

/**
 * Log viewer that aggregates logs from all pods in a deployment.
 * Each log line is prefixed with pod name and color-coded per pod.
 */
export function DeploymentLogViewer({
  deploymentName,
  namespace,
  onOpenInTab,
  autoStream,
}: DeploymentLogViewerProps) {
  const t = useTranslations();

  const {
    logs,
    pods,
    podColorMap,
    isLoading,
    isStreaming,
    error,
    selectedPods,
    togglePodFilter,
    showAllPods,
    startStream,
    stopStream,
    clearLogs,
  } = useDeploymentLogs(deploymentName, namespace);

  // Display options state
  const [lineWrap, setLineWrap] = useState(true);
  const [logColoring, setLogColoring] = useState(true);
  const [timestampMode, setTimestampMode] = useState<TimestampMode>("local");

  const showTimestamps = timestampMode !== "off";
  const timestampLocal = timestampMode === "local";

  // Apply pod filter before other filters
  const podFilteredLogs = useMemo(() => {
    if (selectedPods.size === 0) return logs;
    return logs.filter((log) => selectedPods.has(log.pod));
  }, [logs, selectedPods]);

  // Filter hook operates on pod-filtered logs
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
  } = useLogFilter({ logs: podFilteredLogs });

  useEffect(() => {
    resetFilters();
  }, [namespace, deploymentName, resetFilters]);

  // Auto-start streaming when opened from side panel with active stream
  const autoStreamTriggered = useRef(false);
  useEffect(() => {
    if (autoStream && !autoStreamTriggered.current && pods.length > 0 && !isStreaming) {
      autoStreamTriggered.current = true;
      startStream();
    }
  }, [autoStream, pods.length, isStreaming, startStream]);

  const copyAllLogs = useCallback(async () => {
    try {
      const text = filteredLogs.map((l) => l.message).join("\n");
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard write may fail in some environments
    }
  }, [filteredLogs]);

  const { containerRef, endRef, autoScroll, scrollToBottom, handleScroll } = useAutoScroll({
    dependencies: [logs],
    initialAutoScroll: true,
  });

  const isAllSelected = selectedPods.size === 0;

  return (
    <div className="relative flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="font-medium truncate">
            <Layers className="inline size-4 mr-1.5 -mt-0.5" />
            {t("logs.title")}: {deploymentName}
          </h3>
          <Badge variant="secondary">{namespace}</Badge>
          {isStreaming && (
            <Badge variant="default" className="bg-green-500/10 text-green-500 gap-1">
              <span className="size-2 animate-pulse rounded-full bg-green-500" />
              {t("logs.streamingActive")}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="gap-1">
            {pods.length} {pods.length === 1 ? "Pod" : "Pods"}
          </Badge>
          {onOpenInTab && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => onOpenInTab(isStreaming)}>
                    <Maximize2 className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("logs.openInTab")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Pod filter bar - "Pods:" + "All" pinned left, pod badges scroll */}
      {pods.length > 0 && (
        <div className="flex items-center border-b border-border min-w-0">
          {/* Fixed left: label + All button */}
          <span className="text-xs text-muted-foreground shrink-0 pl-4 pr-2 py-1.5">
            {t("logs.podLegend")}:
          </span>
          <button
            type="button"
            onClick={showAllPods}
            className={`inline-flex items-center gap-1 shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
              isAllSelected
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted/60"
            }`}
          >
            {t("logs.levelAll")}
          </button>
          {/* Separator */}
          <div className="h-5 w-px bg-border shrink-0 ml-2" />
          {/* Scrollable: pod badges */}
          <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto hide-scrollbar py-1.5 pl-2 pr-4">
            {pods.map((pod) => {
              const colors = podColorMap.get(pod.name);
              const isSelected = isAllSelected || selectedPods.has(pod.name);
              return (
                <button
                  key={pod.name}
                  type="button"
                  onClick={() => togglePodFilter(pod.name)}
                  className={`inline-flex items-center gap-1.5 shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? "border-border bg-muted/40 text-foreground"
                      : "border-transparent text-muted-foreground/50 hover:bg-muted/30"
                  }`}
                >
                  <span className={`size-2 rounded-full shrink-0 ${colors?.bg ?? "bg-foreground"}`} />
                  {pod.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
          showPreviousLogs: false,
          onPreviousLogsToggle: () => {},
          previousLogsLabel: "",
          isStreaming,
          hidePreviousLogs: true,
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
          disabled: pods.length === 0,
          onStart: () => startStream(),
          onStop: stopStream,
          onFetch: () => startStream(LOG_DEFAULTS.FETCH_TAIL_LINES),
          followLabel: t("logs.follow"),
          pauseLabel: t("logs.pause"),
          fetchTooltip: t("logs.fetchLogs"),
        }}
        download={{
          isDownloading: false,
          logsCount: logs.length,
          onDownload: async () => {},
          tooltip: t("logs.download"),
        }}
        copyAll={{
          onCopy: copyAllLogs,
          tooltip: t("logs.copyAll"),
        }}
        ai={{
          isAvailable: false,
          onAnalyze: async () => {},
          tooltip: "",
          unavailableTooltip: "",
        }}
        onClear={clearLogs}
        clearLabel={t("logs.clear")}
        hideDownload
        hideAI
      />

      {/* Error display */}
      {error && (
        <div className="px-4 py-2">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Logs container */}
      <LogContent
        ref={containerRef}
        logs={filteredLogs}
        isLoading={isLoading}
        onScroll={handleScroll}
        onStartStream={() => startStream()}
        endRef={endRef}
        showTimestamps={showTimestamps}
        timestampLocal={timestampLocal}
        lineWrap={lineWrap}
        logColoring={logColoring}
        searchQuery={searchQuery}
        useRegex={useRegex}
        searchRegex={searchRegex}
        podColorMap={podColorMap}
        loadingText={t("common.loading")}
        searchingText={t("logs.noMatchesFound", { query: searchQuery.length > LOG_DEFAULTS.MAX_SEARCH_DISPLAY_LENGTH ? searchQuery.slice(0, LOG_DEFAULTS.MAX_SEARCH_DISPLAY_LENGTH) + "..." : searchQuery })}
        noLogsText={pods.length === 0 ? t("logs.noPodsFound") : t("logs.noLogs")}
        followText={t("logs.follow")}
        copyLabel={t("common.copy")}
        copiedLabel={t("common.copied")}
        streamDisabled={pods.length === 0}
      />

      <LogFooter
        filteredCount={filteredLogs.length}
        totalCount={logs.length}
        isFiltered={!!searchQuery || selectedPods.size > 0}
        showScrollButton={!autoScroll && logs.length > 0}
        onScrollToBottom={scrollToBottom}
        autoScrollLabel={t("logs.autoScroll")}
      />
    </div>
  );
}
