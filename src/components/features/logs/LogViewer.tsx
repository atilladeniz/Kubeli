"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import {
  Play,
  Pause,
  Trash2,
  Download,
  Search,
  AlertCircle,
  Loader2,
  ArrowDown,
  Filter,
  Regex,
  FileText,
  FileJson,
  History,
  Sparkles,
} from "lucide-react";
import { useLogs } from "@/lib/hooks/useLogs";
import type { LogEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useAIStore } from "@/lib/stores/ai-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useUIStore } from "@/lib/stores/ui-store";

interface LogViewerProps {
  namespace: string;
  podName: string;
  initialContainer?: string;
  onClose?: () => void;
}

export function LogViewer({
  namespace,
  podName,
  initialContainer,
}: LogViewerProps) {
  const t = useTranslations();
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

  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [logLevel, setLogLevel] = useState<string>("all");
  const [isDownloading, setIsDownloading] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [regexError, setRegexError] = useState<string | null>(null);
  const [previousContainer, setPreviousContainer] = useState(false);

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // AI stores
  const { setPendingAnalysis } = useAIStore();
  const { currentCluster, currentNamespace } = useClusterStore();
  const { setAIAssistantOpen } = useUIStore();

  // Set initial container
  useEffect(() => {
    if (initialContainer && containers.includes(initialContainer)) {
      setSelectedContainer(initialContainer);
    }
  }, [initialContainer, containers, setSelectedContainer]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Validate and compile regex
  const searchRegex = useMemo(() => {
    if (!searchQuery || !useRegex) return null;
    try {
      const regex = new RegExp(searchQuery, "gi");
      setRegexError(null);
      return regex;
    } catch (e) {
      setRegexError((e as Error).message);
      return null;
    }
  }, [searchQuery, useRegex]);

  // Filter logs based on search and log level
  const filteredLogs = useMemo(() => {
    let result = logs;

    // Filter by search query
    if (searchQuery) {
      if (useRegex && searchRegex) {
        result = result.filter((log) => searchRegex.test(log.message));
      } else if (!useRegex) {
        const query = searchQuery.toLowerCase();
        result = result.filter((log) => log.message.toLowerCase().includes(query));
      }
    }

    // Filter by log level
    if (logLevel !== "all") {
      result = result.filter((log) => {
        const msg = log.message.toLowerCase();
        switch (logLevel) {
          case "error":
            return msg.includes("error") || msg.includes("err") || msg.includes("fatal");
          case "warn":
            return msg.includes("warn") || msg.includes("warning");
          case "info":
            return msg.includes("info");
          case "debug":
            return msg.includes("debug") || msg.includes("trace");
          default:
            return true;
        }
      });
    }

    return result;
  }, [logs, searchQuery, logLevel, useRegex, searchRegex]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (!logsContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  // Handle download with format options
  const handleDownload = async (format: "text" | "json" | "timestamps") => {
    setIsDownloading(true);
    try {
      let content: string;
      let defaultFilename: string;
      let extension: string;

      const logsToExport = filteredLogs.length > 0 ? filteredLogs : logs;

      switch (format) {
        case "json":
          content = JSON.stringify(logsToExport, null, 2);
          defaultFilename = `${podName}-${selectedContainer || "logs"}`;
          extension = "json";
          break;
        case "timestamps":
          content = logsToExport
            .map((log) => `${log.timestamp || ""}\t${log.message}`)
            .join("\n");
          defaultFilename = `${podName}-${selectedContainer || "logs"}-timestamps`;
          extension = "log";
          break;
        case "text":
        default:
          content = logsToExport.map((log) => log.message).join("\n");
          defaultFilename = `${podName}-${selectedContainer || "logs"}`;
          extension = "log";
          break;
      }

      // Use Tauri save dialog
      const filePath = await save({
        defaultPath: `${defaultFilename}.${extension}`,
        filters: [
          {
            name: extension === "json" ? "JSON" : "Log File",
            extensions: [extension],
          },
        ],
      });

      if (filePath) {
        await writeTextFile(filePath, content);
        toast.success(t("messages.saveSuccess"));
      }
    } catch (e) {
      console.error("Download failed:", e);
      toast.error(t("messages.saveError"));
    } finally {
      setIsDownloading(false);
    }
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setAutoScroll(true);
  };

  // Analyze logs with AI
  const handleAnalyzeWithAI = useCallback(() => {
    if (!currentCluster) return;

    // Collect logs, prioritizing errors and warnings
    const logsToAnalyze = [...logs];

    // Sort: errors first, then warnings, then by timestamp (newest first)
    logsToAnalyze.sort((a, b) => {
      const levelA = getLogLevel(a.message);
      const levelB = getLogLevel(b.message);

      // Priority: error > warn > rest
      const priority: Record<string, number> = { error: 0, warn: 1, info: 2, debug: 3, default: 4 };
      const priorityDiff = (priority[levelA] || 4) - (priority[levelB] || 4);

      if (priorityDiff !== 0) return priorityDiff;

      // Same priority, sort by timestamp (newest first)
      return (b.timestamp || "").localeCompare(a.timestamp || "");
    });

    // Take relevant logs (max 100 lines to avoid token limits)
    const relevantLogs = logsToAnalyze.slice(0, 100);

    // Count errors and warnings
    const errorCount = relevantLogs.filter(l => getLogLevel(l.message) === "error").length;
    const warnCount = relevantLogs.filter(l => getLogLevel(l.message) === "warn").length;

    // Format logs for AI
    const logsText = relevantLogs
      .map(log => `${log.timestamp ? `[${formatTimestamp(log.timestamp)}] ` : ""}${log.message}`)
      .join("\n");

    // Build the analysis request message
    const message = `Analysiere die Logs des Pods ${namespace}/${podName}${selectedContainer ? ` (Container: ${selectedContainer})` : ""}:

**Log-Statistik**: ${logs.length} Zeilen gesamt, ${errorCount} Errors, ${warnCount} Warnings

**Logs** (sortiert nach Relevanz, max. 100 Zeilen):
\`\`\`
${logsText}
\`\`\`

Bitte analysiere diese Logs und:
1. Identifiziere kritische Fehler oder Probleme
2. Erklaere was die Hauptursache sein koennte
3. Fasse die wichtigsten Muster zusammen`;

    // Set pending analysis and open AI panel
    setPendingAnalysis({
      message,
      clusterContext: currentCluster.context,
      namespace: currentNamespace || undefined,
    });

    setAIAssistantOpen(true);
  }, [logs, namespace, podName, selectedContainer, currentCluster, currentNamespace, setPendingAnalysis, setAIAssistantOpen]);

  return (
    <div className="relative flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3">
          <h3 className="font-medium">
            {t("logs.title")}: {podName}
          </h3>
          <Badge variant="secondary">{namespace}</Badge>
          {isStreaming && (
            <Badge variant="default" className="bg-green-500/10 text-green-500 gap-1">
              <span className="size-2 animate-pulse rounded-full bg-green-500" />
              {t("logs.streamingActive")}
            </Badge>
          )}
        </div>

        {/* Container selector */}
        {containers.length > 1 && (
          <Select
            value={selectedContainer || ""}
            onValueChange={(value) => setSelectedContainer(value || null)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("terminal.selectContainer")} />
            </SelectTrigger>
            <SelectContent>
              {containers.map((container) => (
                <SelectItem key={container} value={container}>
                  {container}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2">
        {/* Search with regex toggle */}
        <div className="relative w-48 shrink-0">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder={useRegex ? "Regex..." : `${t("common.search")}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn("h-8 pl-9 pr-8 text-sm", regexError && useRegex && "border-destructive")}
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setUseRegex(!useRegex)}
                  className={cn(
                    "absolute right-1 top-1/2 -translate-y-1/2 size-6 rounded flex items-center justify-center hover:bg-accent transition-colors",
                    useRegex && "bg-primary/10 text-primary"
                  )}
                >
                  <Regex className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {useRegex ? "Disable regex" : "Enable regex"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Log level filter */}
        <Select value={logLevel} onValueChange={setLogLevel}>
          <SelectTrigger className="h-8 w-fit text-sm shrink-0">
            <Filter className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="error">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-destructive" />
                Error
              </span>
            </SelectItem>
            <SelectItem value="warn">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-yellow-500" />
                Warning
              </span>
            </SelectItem>
            <SelectItem value="info">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-blue-500" />
                Info
              </span>
            </SelectItem>
            <SelectItem value="debug">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-muted-foreground" />
                Debug
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Timestamp toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Checkbox
            id="timestamps"
            checked={showTimestamps}
            onCheckedChange={(checked) => setShowTimestamps(checked as boolean)}
            className="size-4"
          />
          <Label htmlFor="timestamps" className="text-xs text-muted-foreground cursor-pointer">
            {t("logs.timestamps")}
          </Label>
        </div>

        {/* Previous container toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Checkbox
            id="previous"
            checked={previousContainer}
            onCheckedChange={(checked) => setPreviousContainer(checked as boolean)}
            className="size-4"
          />
          <Label htmlFor="previous" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
            <History className="size-3" />
            {t("logs.previous")}
          </Label>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {isStreaming ? (
            <Button
              variant="outline"
              size="sm"
              onClick={stopStream}
              className="h-7 text-xs text-yellow-500 hover:text-yellow-600"
            >
              <Pause className="size-3.5" />
              {t("logs.streamingPaused")}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => startStream()}
              disabled={isLoading}
              className="h-7 text-xs text-green-500 hover:text-green-600"
            >
              <Play className="size-3.5" />
              {t("logs.follow")}
            </Button>
          )}

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fetchLogs({ tail_lines: 500 })}
                  disabled={isLoading || isStreaming}
                  className="size-7"
                >
                  {isLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowDown className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fetch logs</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isDownloading || logs.length === 0}
                  className="size-7"
                >
                  {isDownloading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDownload("text")}>
                  <FileText className="size-4 mr-2" />
                  Plain Text (.log)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("timestamps")}>
                  <FileText className="size-4 mr-2" />
                  With Timestamps (.log)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("json")}>
                  <FileJson className="size-4 mr-2" />
                  JSON (.json)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleAnalyzeWithAI}
                  disabled={logs.length === 0}
                  className="size-7 text-violet-500 hover:text-violet-600 hover:bg-violet-500/10"
                >
                  <Sparkles className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Logs mit AI analysieren</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearLogs}
                  disabled={logs.length === 0}
                  className="size-7 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("logs.clear")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

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
      <div
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto font-mono text-sm"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            {isLoading ? (
              <>
                <Loader2 className="size-8 animate-spin" />
                <p>{t("common.loading")}</p>
              </>
            ) : searchQuery ? (
              <p>{t("logs.searching")}</p>
            ) : (
              <>
                <p>{t("logs.noLogs")}</p>
                <Button
                  variant="link"
                  onClick={() => startStream()}
                  className="text-primary"
                >
                  {t("logs.follow")}
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="p-2">
            {filteredLogs.map((log, index) => (
              <LogLine
                key={`${log.timestamp}-${index}`}
                log={log}
                showTimestamp={showTimestamps}
                searchQuery={searchQuery}
                useRegex={useRegex}
                searchRegex={searchRegex}
              />
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {!autoScroll && logs.length > 0 && (
        <Button
          onClick={scrollToBottom}
          className="absolute bottom-12 right-4 shadow-lg z-10"
          size="sm"
        >
          <ArrowDown className="size-4" />
          {t("logs.autoScroll")}
        </Button>
      )}

      {/* Log count */}
      <div className="border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
        {filteredLogs.length} of {logs.length} lines
        {searchQuery && " (filtered)"}
      </div>
    </div>
  );
}

// Individual log line component
function LogLine({
  log,
  showTimestamp,
  searchQuery,
  useRegex,
  searchRegex,
}: {
  log: LogEntry;
  showTimestamp: boolean;
  searchQuery: string;
  useRegex: boolean;
  searchRegex: RegExp | null;
}) {
  const logLevel = useMemo(() => getLogLevel(log.message), [log.message]);

  const levelColors: Record<string, string> = {
    error: "text-destructive",
    warn: "text-yellow-500",
    info: "text-blue-500",
    debug: "text-muted-foreground",
    default: "text-foreground",
  };

  const highlightedMessage = useMemo(() => {
    if (!searchQuery) return log.message;

    // Use regex for highlighting if enabled
    if (useRegex && searchRegex) {
      const parts = log.message.split(searchRegex);
      const matches = log.message.match(searchRegex) || [];
      const result: React.ReactNode[] = [];

      parts.forEach((part, i) => {
        result.push(part);
        if (matches[i]) {
          result.push(
            <mark key={i} className="bg-yellow-500/30 text-yellow-200">
              {matches[i]}
            </mark>
          );
        }
      });

      return result;
    }

    // Simple string search highlighting
    const regex = new RegExp(`(${escapeRegExp(searchQuery)})`, "gi");
    const parts = log.message.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-500/30 text-yellow-200">
          {part}
        </mark>
      ) : (
        part
      )
    );
  }, [log.message, searchQuery, useRegex, searchRegex]);

  return (
    <div className="group flex hover:bg-muted/30">
      {showTimestamp && log.timestamp && (
        <span className="mr-2 shrink-0 text-muted-foreground/60">
          {formatTimestamp(log.timestamp)}
        </span>
      )}
      <span className={levelColors[logLevel] || levelColors.default}>
        {highlightedMessage}
      </span>
    </div>
  );
}

// Helper functions
function getLogLevel(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("error") || lower.includes("fatal") || lower.includes("err")) {
    return "error";
  }
  if (lower.includes("warn") || lower.includes("warning")) {
    return "warn";
  }
  if (lower.includes("info")) {
    return "info";
  }
  if (lower.includes("debug") || lower.includes("trace")) {
    return "debug";
  }
  return "default";
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toISOString().split("T")[1].slice(0, 12);
  } catch {
    return timestamp.slice(11, 23);
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
