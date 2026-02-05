"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { DownloadFormat, LogLevelLabels } from "../types";
import {
  SearchInput,
  LogLevelFilter,
  StreamButton,
  ToggleCheckbox,
  FetchButton,
  DownloadButton,
  AIButton,
  ClearButton,
} from "./toolbar";

// Grouped prop interfaces for better organization

export interface SearchProps {
  query: string;
  onChange: (query: string) => void;
  useRegex: boolean;
  onRegexToggle: () => void;
  regexError: string | null;
  placeholder: string;
  enableRegexTooltip: string;
  disableRegexTooltip: string;
}

export interface FilterProps {
  logLevel: string;
  onLogLevelChange: (level: string) => void;
  logLevelLabels: LogLevelLabels;
  showTimestamps: boolean;
  onTimestampsToggle: (checked: boolean) => void;
  timestampsLabel: string;
  showPreviousLogs: boolean;
  onPreviousLogsToggle: (checked: boolean) => void;
  previousLogsLabel: string;
  isStreaming?: boolean;
}

export interface StreamProps {
  isStreaming: boolean;
  isLoading: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  onFetch: () => void;
  followLabel: string;
  pauseLabel: string;
  fetchTooltip: string;
}

export interface DownloadProps {
  isDownloading: boolean;
  logsCount: number;
  onDownload: (format: DownloadFormat) => void;
}

export interface AIProps {
  isAvailable: boolean | null;
  onAnalyze: () => void;
  tooltip: string;
  unavailableTooltip: string;
}

interface LogToolbarProps {
  search: SearchProps;
  filter: FilterProps;
  stream: StreamProps;
  download: DownloadProps;
  ai: AIProps;
  onClear: () => void;
  clearLabel: string;
  hideClear?: boolean;
}

/**
 * Toolbar component with all log viewer controls.
 * Props are grouped into logical categories for better organization.
 */
export function LogToolbar({
  search,
  filter,
  stream,
  download,
  ai,
  onClear,
  clearLabel,
  hideClear,
}: LogToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2">
      {/* Search with regex toggle */}
      <SearchInput
        value={search.query}
        onChange={search.onChange}
        useRegex={search.useRegex}
        onRegexToggle={search.onRegexToggle}
        regexError={search.regexError}
        placeholder={search.placeholder}
        enableRegexTooltip={search.enableRegexTooltip}
        disableRegexTooltip={search.disableRegexTooltip}
      />

      {/* Log level filter */}
      <LogLevelFilter value={filter.logLevel} onChange={filter.onLogLevelChange} labels={filter.logLevelLabels} />

      {/* Timestamp toggle */}
      <ToggleCheckbox
        id="timestamps"
        checked={filter.showTimestamps}
        onCheckedChange={filter.onTimestampsToggle}
        label={filter.timestampsLabel}
      />

      {/* Previous logs toggle (disabled during streaming) */}
      <ToggleCheckbox
        id="previous-logs"
        checked={filter.showPreviousLogs}
        onCheckedChange={filter.onPreviousLogsToggle}
        label={filter.previousLogsLabel}
        disabled={filter.isStreaming}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        <StreamButton
          isStreaming={stream.isStreaming}
          isLoading={stream.isLoading}
          disabled={stream.disabled}
          onStart={stream.onStart}
          onStop={stream.onStop}
          followLabel={stream.followLabel}
          pauseLabel={stream.pauseLabel}
        />

        <TooltipProvider delayDuration={300}>
          <FetchButton
            isLoading={stream.isLoading}
            isStreaming={stream.isStreaming}
            disabled={!!stream.disabled}
            onFetch={stream.onFetch}
            tooltip={stream.fetchTooltip}
          />

          <DownloadButton
            isDownloading={download.isDownloading}
            disabled={download.logsCount === 0}
            onDownload={download.onDownload}
          />

          <AIButton
            isAvailable={ai.isAvailable}
            disabled={download.logsCount === 0}
            onClick={ai.onAnalyze}
            tooltip={ai.tooltip}
            unavailableTooltip={ai.unavailableTooltip}
          />

          <ClearButton disabled={download.logsCount === 0 || !!hideClear} onClick={onClear} tooltip={clearLabel} />
        </TooltipProvider>
      </div>
    </div>
  );
}
