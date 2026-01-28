"use client";

import { useState, useCallback } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import type { LogEntry } from "@/lib/types";
import type { DownloadFormat } from "../types";

interface UseLogDownloadOptions {
  podName: string;
  container: string | null;
  logs: LogEntry[];
  filteredLogs: LogEntry[];
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
  podName,
  container,
  logs,
  filteredLogs,
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
          podName,
          container
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
          toast.success(t("messages.saveSuccess"));
        }
      } catch (e) {
        console.error("Download failed:", e);
        toast.error(t("messages.saveError"));
      } finally {
        setIsDownloading(false);
      }
    },
    [logs, filteredLogs, podName, container, t]
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
  podName: string,
  container: string | null
): { content: string; filename: string; extension: string } {
  const containerSuffix = container || "logs";

  switch (format) {
    case "json":
      return {
        content: JSON.stringify(logs, null, 2),
        filename: `${podName}-${containerSuffix}`,
        extension: "json",
      };

    case "timestamps":
      return {
        content: logs.map((log) => `${log.timestamp || ""}\t${log.message}`).join("\n"),
        filename: `${podName}-${containerSuffix}-timestamps`,
        extension: "log",
      };

    case "text":
    default:
      return {
        content: logs.map((log) => log.message).join("\n"),
        filename: `${podName}-${containerSuffix}`,
        extension: "log",
      };
  }
}
