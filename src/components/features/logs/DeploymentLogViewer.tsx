"use client";

import React, {
  forwardRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { AlertCircle, Layers, Loader2, Copy, Check, SearchX } from "lucide-react";
import { useDeploymentLogs, type PodColorEntry } from "@/lib/hooks/useDeploymentLogs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { LogToolbar, LogFooter } from "./components";
import { DeploymentLogLine } from "./components/DeploymentLogLine";
import { useLogFilter, useAutoScroll } from "./hooks";
import { LOG_DEFAULTS } from "./types";
import type { TimestampMode } from "./types";
import type { LogEntry } from "@/lib/types";

interface DeploymentLogViewerProps {
  deploymentName: string;
  namespace: string;
}

/**
 * Log viewer that aggregates logs from all pods in a deployment.
 * Each log line is prefixed with pod name and color-coded per pod.
 */
export function DeploymentLogViewer({
  deploymentName,
  namespace,
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

  const copyAllLogs = useCallback(async () => {
    const text = filteredLogs.map((l) => l.message).join("\n");
    await navigator.clipboard.writeText(text);
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
          onCopyAll: copyAllLogs,
          copyAllTooltip: t("logs.copyAll"),
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
      <DeploymentLogContent
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
        searchingText={t("logs.noMatchesFound", { query: searchQuery.length > 40 ? searchQuery.slice(0, 40) + "..." : searchQuery })}
        noLogsText={pods.length === 0 ? t("logs.noPodsFound") : t("logs.noLogs")}
        followText={t("logs.follow")}
        copyLabel={t("common.copy")}
        copiedLabel={t("common.copied")}
        noPods={pods.length === 0}
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

// --- Internal component for deployment log content ---

interface DeploymentLogContentProps {
  logs: LogEntry[];
  isLoading: boolean;
  onScroll: () => void;
  onStartStream: () => void;
  endRef?: React.RefObject<HTMLDivElement | null>;
  showTimestamps: boolean;
  timestampLocal?: boolean;
  lineWrap?: boolean;
  logColoring?: boolean;
  searchQuery: string;
  useRegex: boolean;
  searchRegex: RegExp | null;
  podColorMap: Map<string, PodColorEntry>;
  loadingText: string;
  searchingText: string;
  noLogsText: string;
  followText: string;
  copyLabel: string;
  copiedLabel: string;
  noPods: boolean;
}

const DeploymentLogContent = forwardRef<HTMLDivElement, DeploymentLogContentProps>(
  function DeploymentLogContent(
    {
      logs,
      isLoading,
      onScroll,
      onStartStream,
      endRef,
      showTimestamps,
      timestampLocal,
      lineWrap,
      logColoring,
      searchQuery,
      useRegex,
      searchRegex,
      podColorMap,
      loadingText,
      searchingText,
      noLogsText,
      followText,
      copyLabel,
      copiedLabel,
      noPods,
    },
    ref
  ) {
    const menuRef = useRef<HTMLDivElement>(null);
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
    const [contextMenuSelection, setContextMenuSelection] = useState("");
    const [copied, setCopied] = useState(false);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
      const sel = window.getSelection();
      const text = sel?.toString() ?? "";
      if (!text) return;
      e.preventDefault();
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      setCopied(false);
      setContextMenuSelection(text);
      setMenuPos({ x: e.clientX, y: e.clientY });
    }, []);

    useEffect(() => {
      if (!menuPos) return;
      const handleMouseDown = (e: MouseEvent) => {
        if (menuRef.current?.contains(e.target as Node)) return;
        setMenuPos(null);
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setMenuPos(null);
      };
      window.addEventListener("mousedown", handleMouseDown);
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("mousedown", handleMouseDown);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [menuPos]);

    const handleCopy = useCallback(async () => {
      if (!contextMenuSelection) return;
      try {
        await navigator.clipboard.writeText(contextMenuSelection);
        setCopied(true);
        copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
      } catch {
        // Fallback handled by browser
      }
      setMenuPos(null);
    }, [contextMenuSelection]);

    if (logs.length === 0) {
      return (
        <div className="flex-1 overflow-auto font-mono text-sm">
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            {isLoading ? (
              <>
                <Loader2 className="size-8 animate-spin" />
                <p>{loadingText}</p>
              </>
            ) : searchQuery ? (
              <>
                <SearchX className="size-8" />
                <p className="px-4 text-center">{searchingText}</p>
              </>
            ) : (
              <>
                <p>{noLogsText}</p>
                {!noPods && (
                  <Button variant="link" onClick={onStartStream} className="text-primary">
                    {followText}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      );
    }

    return (
      <>
        <div
          ref={ref}
          onScroll={onScroll}
          onContextMenu={handleContextMenu}
          className="flex-1 overflow-auto"
        >
          <pre
            className={`m-0 p-2 font-mono text-sm leading-5 ${lineWrap ? "whitespace-pre-wrap break-all" : ""}`}
            data-allow-context-menu
          >
            {logs.map((log, index) => (
              <DeploymentLogLine
                key={`${log.pod}-${log.timestamp}-${index}`}
                log={log}
                showTimestamp={showTimestamps}
                timestampLocal={timestampLocal}
                logColoring={logColoring}
                searchQuery={searchQuery}
                useRegex={useRegex}
                searchRegex={searchRegex}
                podColor={podColorMap.get(log.pod)?.text}
              />
            ))}
            {endRef && <span ref={endRef as React.RefObject<HTMLSpanElement>} />}
          </pre>
        </div>

        {menuPos && (
          <div
            ref={menuRef}
            className="opaque-popover bg-popover text-popover-foreground fixed z-50 min-w-[8rem] rounded-md border p-1 shadow-md"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            <button
              onClick={handleCopy}
              disabled={!contextMenuSelection}
              className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none disabled:pointer-events-none disabled:opacity-50"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? copiedLabel : copyLabel}
            </button>
          </div>
        )}
      </>
    );
  }
);
