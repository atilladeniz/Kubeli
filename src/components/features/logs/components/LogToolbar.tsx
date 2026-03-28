"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { DownloadFormat, LogLevelLabels, TimestampMode } from "../types";
import type { DisplayOptionsLabels } from "./toolbar/DisplayOptionsPopover";
import {
  SearchInput,
  LogLevelFilter,
  StreamButton,
  ToggleCheckbox,
  DisplayOptionsPopover,
  FetchButton,
  DownloadButton,
  AIButton,
  ClearButton,
} from "./toolbar";

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
  showPreviousLogs: boolean;
  onPreviousLogsToggle: (checked: boolean) => void;
  previousLogsLabel: string;
  isStreaming?: boolean;
  hidePreviousLogs?: boolean;
}

export interface DisplayOptionsProps {
  lineWrap: boolean;
  onLineWrapChange: (checked: boolean) => void;
  logColoring: boolean;
  onLogColoringChange: (checked: boolean) => void;
  timestampMode: TimestampMode;
  onTimestampModeChange: (mode: TimestampMode) => void;
  labels: DisplayOptionsLabels;
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
  tooltip: string;
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
  displayOptions: DisplayOptionsProps;
  stream: StreamProps;
  download: DownloadProps;
  ai: AIProps;
  onClear: () => void;
  clearLabel: string;
  hideClear?: boolean;
  hideDownload?: boolean;
  hideAI?: boolean;
}

/**
 * Toolbar component with all log viewer controls.
 * Props are grouped into logical categories for better organization.
 */
export function LogToolbar({
  search,
  filter,
  displayOptions,
  stream,
  download,
  ai,
  onClear,
  clearLabel,
  hideClear,
  hideDownload,
  hideAI,
}: LogToolbarProps) {
  return (
    <div className="flex items-center gap-x-3 border-b border-border px-4 py-2 overflow-x-auto hide-scrollbar">
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

      {/* Previous logs toggle (disabled during streaming) */}
      {!filter.hidePreviousLogs && (
        <ToggleCheckbox
          id="previous-logs"
          checked={filter.showPreviousLogs}
          onCheckedChange={filter.onPreviousLogsToggle}
          label={filter.previousLogsLabel}
          disabled={filter.isStreaming}
        />
      )}

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

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

          {!hideDownload && (
            <DownloadButton
              isDownloading={download.isDownloading}
              disabled={download.logsCount === 0}
              onDownload={download.onDownload}
              tooltip={download.tooltip}
            />
          )}

          <DisplayOptionsPopover
            lineWrap={displayOptions.lineWrap}
            onLineWrapChange={displayOptions.onLineWrapChange}
            logColoring={displayOptions.logColoring}
            onLogColoringChange={displayOptions.onLogColoringChange}
            timestampMode={displayOptions.timestampMode}
            onTimestampModeChange={displayOptions.onTimestampModeChange}
            labels={displayOptions.labels}
          />

          {!hideAI && (
            <AIButton
              isAvailable={ai.isAvailable}
              disabled={download.logsCount === 0}
              onClick={ai.onAnalyze}
              tooltip={ai.tooltip}
              unavailableTooltip={ai.unavailableTooltip}
            />
          )}

          <ClearButton disabled={download.logsCount === 0 || !!hideClear} onClick={onClear} tooltip={clearLabel} />
        </TooltipProvider>
      </div>
    </div>
  );
}
