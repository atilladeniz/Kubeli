"use client";

import {
  Play,
  Pause,
  Trash2,
  Download,
  Search,
  Loader2,
  ArrowDown,
  Filter,
  Regex,
  FileText,
  FileJson,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import type { DownloadFormat } from "../types";
import { DOWNLOAD_FORMATS, LOG_FILTER_OPTIONS } from "../types";

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
  showTimestamps: boolean;
  onTimestampsToggle: (checked: boolean) => void;
  timestampsLabel: string;
}

export interface StreamProps {
  isStreaming: boolean;
  isLoading: boolean;
  onStart: () => void;
  onStop: () => void;
  onFetch: () => void;
  followLabel: string;
  pausedLabel: string;
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
      <LogLevelFilter value={filter.logLevel} onChange={filter.onLogLevelChange} />

      {/* Timestamp toggle */}
      <ToggleCheckbox
        id="timestamps"
        checked={filter.showTimestamps}
        onCheckedChange={filter.onTimestampsToggle}
        label={filter.timestampsLabel}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        <StreamButton
          isStreaming={stream.isStreaming}
          isLoading={stream.isLoading}
          onStart={stream.onStart}
          onStop={stream.onStop}
          followLabel={stream.followLabel}
          pausedLabel={stream.pausedLabel}
        />

        <TooltipProvider delayDuration={300}>
          <FetchButton
            isLoading={stream.isLoading}
            isStreaming={stream.isStreaming}
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

          <ClearButton disabled={download.logsCount === 0} onClick={onClear} tooltip={clearLabel} />
        </TooltipProvider>
      </div>
    </div>
  );
}

// Sub-components

function SearchInput({
  value,
  onChange,
  useRegex,
  onRegexToggle,
  regexError,
  placeholder,
  enableRegexTooltip,
  disableRegexTooltip,
}: {
  value: string;
  onChange: (value: string) => void;
  useRegex: boolean;
  onRegexToggle: () => void;
  regexError: string | null;
  placeholder: string;
  enableRegexTooltip: string;
  disableRegexTooltip: string;
}) {
  return (
    <div className="relative w-48 shrink-0">
      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        placeholder={useRegex ? "Regex..." : placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-8 pl-9 pr-8 text-sm", regexError && useRegex && "border-destructive")}
      />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onRegexToggle}
              className={cn(
                "absolute right-1 top-1/2 -translate-y-1/2 size-6 rounded flex items-center justify-center hover:bg-accent transition-colors",
                useRegex && "bg-primary/10 text-primary"
              )}
            >
              <Regex className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{useRegex ? disableRegexTooltip : enableRegexTooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function LogLevelFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-fit text-sm shrink-0">
        <Filter className="size-3.5 text-muted-foreground" />
        <SelectValue placeholder="All Levels" />
      </SelectTrigger>
      <SelectContent>
        {LOG_FILTER_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.color ? (
              <span className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", option.color)} />
                {option.label}
              </span>
            ) : (
              option.label
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ToggleCheckbox({
  id,
  checked,
  onCheckedChange,
  label,
  icon,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(checked) => onCheckedChange(checked as boolean)}
        className="size-4"
      />
      <Label
        htmlFor={id}
        className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
      >
        {icon}
        {label}
      </Label>
    </div>
  );
}

function StreamButton({
  isStreaming,
  isLoading,
  onStart,
  onStop,
  followLabel,
  pausedLabel,
}: {
  isStreaming: boolean;
  isLoading: boolean;
  onStart: () => void;
  onStop: () => void;
  followLabel: string;
  pausedLabel: string;
}) {
  if (isStreaming) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onStop}
        className="h-7 text-xs text-yellow-500 hover:text-yellow-600"
      >
        <Pause className="size-3.5" />
        {pausedLabel}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onStart}
      disabled={isLoading}
      className="h-7 text-xs text-green-500 hover:text-green-600"
    >
      <Play className="size-3.5" />
      {followLabel}
    </Button>
  );
}

function FetchButton({
  isLoading,
  isStreaming,
  onFetch,
  tooltip,
}: {
  isLoading: boolean;
  isStreaming: boolean;
  onFetch: () => void;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onFetch}
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
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function DownloadButton({
  isDownloading,
  disabled,
  onDownload,
}: {
  isDownloading: boolean;
  disabled: boolean;
  onDownload: (format: DownloadFormat) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isDownloading || disabled} className="size-7">
          {isDownloading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {DOWNLOAD_FORMATS.map(({ format, label }) => (
          <DropdownMenuItem key={format} onClick={() => onDownload(format)}>
            {format === "json" ? (
              <FileJson className="size-4 mr-2" />
            ) : (
              <FileText className="size-4 mr-2" />
            )}
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AIButton({
  isAvailable,
  disabled,
  onClick,
  tooltip,
  unavailableTooltip,
}: {
  isAvailable: boolean | null;
  disabled: boolean;
  onClick: () => void;
  tooltip: string;
  unavailableTooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled || isAvailable === false}
          className={cn(
            "size-7 text-violet-500 hover:text-violet-600 hover:bg-violet-500/10",
            isAvailable === false && "opacity-50 cursor-not-allowed"
          )}
        >
          <Sparkles className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isAvailable === false ? (
          <span className="text-muted-foreground">{unavailableTooltip}</span>
        ) : (
          tooltip
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function ClearButton({
  disabled,
  onClick,
  tooltip,
}: {
  disabled: boolean;
  onClick: () => void;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          className="size-7 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
