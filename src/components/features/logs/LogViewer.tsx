"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useLogs } from "@/lib/hooks/useLogs";
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

  // Local UI state
  const [showTimestamps, setShowTimestamps] = useState(true);

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
  } = useLogFilter({ logs });

  // Auto-scroll hook - handles all scroll logic
  const { containerRef, endRef, autoScroll, scrollToBottom, handleScroll } = useAutoScroll({
    dependencies: [logs],
  });

  // AI analysis hook
  const { isAICliAvailable, analyzeWithAI } = useLogAnalysis({
    namespace,
    podName,
    container: selectedContainer,
    logs,
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
        // Search
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        useRegex={useRegex}
        onRegexToggle={() => setUseRegex(!useRegex)}
        regexError={regexError}
        searchPlaceholder={`${t("common.search")}...`}
        // Log level
        logLevel={logLevel}
        onLogLevelChange={setLogLevel}
        // Toggles
        showTimestamps={showTimestamps}
        onTimestampsToggle={setShowTimestamps}
        timestampsLabel={t("logs.timestamps")}
        // Stream
        isStreaming={isStreaming}
        isLoading={isLoading}
        onStartStream={() => startStream()}
        onStopStream={stopStream}
        onFetchLogs={() => fetchLogs({ tail_lines: LOG_DEFAULTS.FETCH_TAIL_LINES })}
        followLabel={t("logs.follow")}
        pausedLabel={t("logs.streamingPaused")}
        fetchLogsTooltip={t("logs.fetchLogs")}
        // Download
        isDownloading={isDownloading}
        logsCount={logs.length}
        onDownload={downloadLogs}
        // AI
        isAIAvailable={isAICliAvailable}
        onAnalyzeWithAI={analyzeWithAI}
        aiTooltip={t("logs.analyzeWithAI")}
        aiUnavailableTooltip={t("logs.aiUnavailable")}
        // Clear
        onClear={clearLogs}
        clearLabel={t("logs.clear")}
        // Regex tooltips
        enableRegexTooltip={t("logs.enableRegex")}
        disableRegexTooltip={t("logs.disableRegex")}
      />

      {/* Error display */}
      {error && (
        <div className="px-4 py-2">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
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
        loadingText={t("common.loading")}
        searchingText={t("logs.searching")}
        noLogsText={t("logs.noLogs")}
        followText={t("logs.follow")}
      />

      {/* Scroll end marker - used by useAutoScroll */}
      <div ref={endRef} />

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
