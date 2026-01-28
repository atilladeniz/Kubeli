/**
 * Log level detection and styling constants.
 */

export type LogLevel = "error" | "warn" | "info" | "debug" | "default";

export const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  error: "text-destructive",
  warn: "text-yellow-500",
  info: "text-blue-500",
  debug: "text-muted-foreground",
  default: "text-foreground",
};

export const LOG_FILTER_OPTIONS: Array<{
  value: string;
  color?: string;
}> = [
  { value: "all" },
  { value: "error", color: "bg-destructive" },
  { value: "warn", color: "bg-yellow-500" },
  { value: "info", color: "bg-blue-500" },
  { value: "debug", color: "bg-muted-foreground" },
];

/** Labels for log level filter options (i18n keys) */
export type LogLevelLabels = Record<string, string>;

/**
 * Default values for log viewer behavior.
 */
export const LOG_DEFAULTS = {
  /** Number of lines to fetch initially */
  FETCH_TAIL_LINES: 500,
  /** Maximum logs to analyze with AI */
  AI_ANALYSIS_MAX_LINES: 100,
  /** Scroll threshold for auto-scroll detection */
  SCROLL_THRESHOLD: 50,
} as const;

/**
 * Download format options.
 */
export type DownloadFormat = "text" | "json" | "timestamps";

export const DOWNLOAD_FORMATS: Array<{
  format: DownloadFormat;
  label: string;
  extension: string;
}> = [
  { format: "text", label: "Plain Text (.log)", extension: "log" },
  { format: "timestamps", label: "With Timestamps (.log)", extension: "log" },
  { format: "json", label: "JSON (.json)", extension: "json" },
];
