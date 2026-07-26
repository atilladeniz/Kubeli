"use client";

import { useState, useEffect, useCallback } from "react";
import type { LogEntry } from "@/lib/types";
import { useAIStore } from "@/lib/stores/ai-store";
import { useClusterStore, selectCurrentNamespace } from "@/lib/stores/cluster-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { aiCheckCliAvailable, aiCheckCodexCliAvailable } from "@/lib/tauri/commands";
import { getLogLevel, formatTimestamp, stripAnsi } from "../lib";
import { LOG_DEFAULTS } from "../types";

interface UseLogAnalysisOptions {
  namespace: string;
  /** Pod name, or workload name when analyzing aggregated logs */
  sourceName: string;
  container: string | null;
  logs: LogEntry[];
  /**
   * Labels each log line with its source pod and titles the prompt as a
   * workload analysis. Set for aggregated multi-pod logs so the AI can tell
   * a single bad replica apart from a cluster-wide problem.
   */
  workloadKind?: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}

interface UseLogAnalysisReturn {
  /** Whether AI CLI is available */
  isAICliAvailable: boolean | null;
  /** Analyze logs with AI assistant */
  analyzeWithAI: () => void;
  /** Send a user-selected excerpt to the AI assistant */
  sendSelectionToAI: (selectedText: string) => void;
}

/**
 * Hook for AI-powered log analysis.
 * Checks CLI availability and handles sending logs to AI assistant.
 */
export function useLogAnalysis({
  namespace,
  sourceName,
  container,
  logs,
  workloadKind,
  t,
}: UseLogAnalysisOptions): UseLogAnalysisReturn {
  const [isAICliAvailable, setIsAICliAvailable] = useState<boolean | null>(null);

  const setPendingAnalysis = useAIStore((s) => s.setPendingAnalysis);
  const currentCluster = useClusterStore((s) => s.currentCluster);
  const currentNamespace = useClusterStore(selectCurrentNamespace);
  const setAIAssistantOpen = useUIStore((s) => s.setAIAssistantOpen);

  // Check AI CLI availability on mount
  useEffect(() => {
    const checkAiClis = async () => {
      try {
        const [claudeInfo, codexInfo] = await Promise.all([
          aiCheckCliAvailable().catch(() => ({ status: "error" as const })),
          aiCheckCodexCliAvailable().catch(() => ({ status: "error" as const })),
        ]);
        const claudeAvailable = claudeInfo.status === "authenticated";
        const codexAvailable = codexInfo.status === "authenticated";
        setIsAICliAvailable(claudeAvailable || codexAvailable);
      } catch {
        setIsAICliAvailable(false);
      }
    };
    checkAiClis();
  }, []);

  const analyzeWithAI = useCallback(() => {
    if (!currentCluster || logs.length === 0) return;

    // Collect and sort logs by relevance
    const sortedLogs = sortLogsByRelevance([...logs]);

    // Take relevant logs (max lines to avoid token limits)
    const relevantLogs = sortedLogs.slice(0, LOG_DEFAULTS.AI_ANALYSIS_MAX_LINES);

    // Count errors and warnings
    const errorCount = relevantLogs.filter((l) => getLogLevel(l.message) === "error").length;
    const warnCount = relevantLogs.filter((l) => getLogLevel(l.message) === "warn").length;

    // Format logs for AI. Aggregated logs carry the pod name per line so the
    // AI can attribute a failure to one replica instead of the whole workload.
    const logsText = relevantLogs
      .map(
        (log) =>
          `${log.timestamp ? `[${formatTimestamp(log.timestamp)}] ` : ""}` +
          `${workloadKind ? `[${log.pod}] ` : ""}${stripAnsi(log.message)}`
      )
      .join("\n");

    // Build the analysis request message using i18n
    const containerInfo = container ? ` (Container: ${container})` : "";
    const title = workloadKind
      ? t("logs.aiPromptTitleWorkload", {
          namespace,
          workloadKind,
          workloadName: sourceName,
          podCount: new Set(relevantLogs.map((l) => l.pod)).size,
        })
      : t("logs.aiPromptTitle", { namespace, podName: sourceName, containerInfo });
    const stats = t("logs.aiPromptStats", {
      total: logs.length,
      errors: errorCount,
      warnings: warnCount,
    });
    const logsHeader = t("logs.aiPromptLogsHeader", { maxLines: LOG_DEFAULTS.AI_ANALYSIS_MAX_LINES });
    const instructions = t("logs.aiPromptInstructions");

    const message = `${title}

${stats}

${logsHeader}
\`\`\`
${logsText}
\`\`\`

${instructions}`;

    // Set pending analysis and open AI panel
    setPendingAnalysis({
      message,
      clusterContext: currentCluster.context,
      namespace: currentNamespace || undefined,
    });

    setAIAssistantOpen(true);
  }, [
    logs,
    namespace,
    sourceName,
    container,
    workloadKind,
    currentCluster,
    currentNamespace,
    setPendingAnalysis,
    setAIAssistantOpen,
    t,
  ]);

  const sendSelectionToAI = useCallback(
    (selectedText: string) => {
      if (!isAICliAvailable || !currentCluster) return;
      const selectionTitle = workloadKind
        ? t("logs.aiSelectionPromptWorkload", {
            namespace,
            workloadKind,
            workloadName: sourceName,
          })
        : t("logs.aiSelectionPrompt", { namespace, podName: sourceName });
      const message = selectionTitle + "\n```\n" + selectedText + "\n```";
      setPendingAnalysis({
        message,
        clusterContext: currentCluster.context,
        namespace: currentNamespace || undefined,
      });
      setAIAssistantOpen(true);
    },
    [
      isAICliAvailable,
      currentCluster,
      currentNamespace,
      namespace,
      sourceName,
      workloadKind,
      setPendingAnalysis,
      setAIAssistantOpen,
      t,
    ]
  );

  return {
    isAICliAvailable,
    analyzeWithAI,
    sendSelectionToAI,
  };
}

/**
 * Sorts logs by relevance: errors first, then warnings, then by timestamp.
 */
function sortLogsByRelevance(logs: LogEntry[]): LogEntry[] {
  const priority: Record<string, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    default: 4,
  };

  return logs.sort((a, b) => {
    const levelA = getLogLevel(a.message);
    const levelB = getLogLevel(b.message);

    const priorityDiff = (priority[levelA] ?? 4) - (priority[levelB] ?? 4);
    if (priorityDiff !== 0) return priorityDiff;

    // Same priority, sort by timestamp (newest first)
    return (b.timestamp || "").localeCompare(a.timestamp || "");
  });
}
