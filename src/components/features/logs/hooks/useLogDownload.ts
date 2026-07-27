"use client";

import { useState, useCallback } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import type { LogEntry } from "@/lib/types";
import { stripAnsi } from "../lib";
import type { DownloadFormat } from "../types";

interface UseLogDownloadOptions {
  /** Base name for the exported file (pod name, or workload name when aggregated) */
  sourceName: string;
  container: string | null;
  logs: LogEntry[];
  filteredLogs: LogEntry[];
  /**
   * Prefixes every exported line with its source pod. Set for aggregated
   * multi-pod logs, where the line alone does not identify the replica.
   */
  includePodNames?: boolean;
  t: (key: string) => string;
}

interface UseLogDownloadReturn {
  /** Whether a download is in progress */
  isDownloading: boolean;
  /** Download logs in the specified format */
  downloadLogs: (format: DownloadFormat) => Promise<void>;
}

/**
 * Hook for downloading logs in various formats.
 * Supports plain text, timestamped text, and JSON formats.
 */
export function useLogDownload({
  sourceName,
  container,
  logs,
  filteredLogs,
  includePodNames = false,
  t,
}: UseLogDownloadOptions): UseLogDownloadReturn {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadLogs = useCallback(
    async (format: DownloadFormat) => {
      setIsDownloading(true);
      try {
        const logsToExport = filteredLogs.length > 0 ? filteredLogs : logs;
        const { content, filename, extension } = formatLogsForExport(
          logsToExport,
          format,
          sourceName,
          container,
          includePodNames
        );

        // Use Tauri save dialog
        const filePath = await save({
          defaultPath: `${filename}.${extension}`,
          filters: [
            {
              name: extension === "json" ? "JSON" : "Log File",
              extensions: [extension],
            },
          ],
        });

        if (filePath) {
          await writeTextFile(filePath, content);
          toast.success(t("logs.downloadSuccess"));
        }
      } catch (e) {
        console.error("Download failed:", e);
        toast.error(t("logs.downloadError"));
      } finally {
        setIsDownloading(false);
      }
    },
    [logs, filteredLogs, sourceName, container, includePodNames, t]
  );

  return {
    isDownloading,
    downloadLogs,
  };
}

/**
 * Formats logs for export based on the specified format.
 */
function formatLogsForExport(
  logs: LogEntry[],
  format: DownloadFormat,
  sourceName: string,
  container: string | null,
  includePodNames: boolean
): { content: string; filename: string; extension: string } {
  const containerSuffix = container || "logs";
  // JSON already carries log.pod per entry, so the prefix only applies to text.
  const podPrefix = (log: LogEntry) => (includePodNames ? `[${log.pod}] ` : "");
  // Escape codes are display-only; an exported file should be readable text.
  const plain = (log: LogEntry) => stripAnsi(log.message);

  switch (format) {
    case "json":
      return {
        content: JSON.stringify(
          logs.map((log) => ({ ...log, message: plain(log) })),
          null,
          2
        ),
        filename: `${sourceName}-${containerSuffix}`,
        extension: "json",
      };

    case "timestamps":
      return {
        content: logs
          .map((log) => `${log.timestamp || ""}\t${podPrefix(log)}${plain(log)}`)
          .join("\n"),
        filename: `${sourceName}-${containerSuffix}-timestamps`,
        extension: "log",
      };

    case "text":
    default:
      return {
        content: logs.map((log) => `${podPrefix(log)}${plain(log)}`).join("\n"),
        filename: `${sourceName}-${containerSuffix}`,
        extension: "log",
      };
  }
}
