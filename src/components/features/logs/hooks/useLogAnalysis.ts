"use client";

import { useState, useEffect, useCallback } from "react";
import type { LogEntry } from "@/lib/types";
import { useAIStore } from "@/lib/stores/ai-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { aiCheckCliAvailable, aiCheckCodexCliAvailable } from "@/lib/tauri/commands";
import { getLogLevel, formatTimestamp } from "../lib";
import { LOG_DEFAULTS } from "../types";

interface UseLogAnalysisOptions {
  namespace: string;
  podName: string;
  container: string | null;
  logs: LogEntry[];
  t: (key: string, values?: Record<string, string | number>) => string;
}

interface UseLogAnalysisReturn {
  /** Whether AI CLI is available */
  isAICliAvailable: boolean | null;
  /** Analyze logs with AI assistant */
  analyzeWithAI: () => void;
}

/**
 * Hook for AI-powered log analysis.
 * Checks CLI availability and handles sending logs to AI assistant.
 */
export function useLogAnalysis({
  namespace,
  podName,
  container,
  logs,
  t,
}: UseLogAnalysisOptions): UseLogAnalysisReturn {
  const [isAICliAvailable, setIsAICliAvailable] = useState<boolean | null>(null);

  const { setPendingAnalysis } = useAIStore();
  const { currentCluster, currentNamespace } = useClusterStore();
  const { setAIAssistantOpen } = useUIStore();

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

    // Format logs for AI
    const logsText = relevantLogs
      .map((log) => `${log.timestamp ? `[${formatTimestamp(log.timestamp)}] ` : ""}${log.message}`)
      .join("\n");

    // Build the analysis request message using i18n
    const containerInfo = container ? ` (Container: ${container})` : "";
    const title = t("logs.aiPromptTitle", { namespace, podName, containerInfo });
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
    podName,
    container,
    currentCluster,
    currentNamespace,
    setPendingAnalysis,
    setAIAssistantOpen,
    t,
  ]);

  return {
    isAICliAvailable,
    analyzeWithAI,
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

    const priorityDiff = (priority[levelA] || 4) - (priority[levelB] || 4);
    if (priorityDiff !== 0) return priorityDiff;

    // Same priority, sort by timestamp (newest first)
    return (b.timestamp || "").localeCompare(a.timestamp || "");
  });
}
