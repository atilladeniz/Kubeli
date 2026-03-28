"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Trash2, Download, Loader2, ArrowDown, FileText, FileJson, Sparkles, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { DownloadFormat } from "../../types";
import { DOWNLOAD_FORMATS } from "../../types";

// Fetch Button
interface FetchButtonProps {
  isLoading: boolean;
  isStreaming: boolean;
  disabled?: boolean;
  onFetch: () => void;
  tooltip: string;
}

export function FetchButton({ isLoading, isStreaming, disabled, onFetch, tooltip }: FetchButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onFetch}
          disabled={isLoading || isStreaming || disabled}
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

// Download Button
interface DownloadButtonProps {
  isDownloading: boolean;
  disabled: boolean;
  onDownload: (format: DownloadFormat) => void;
  tooltip: string;
}

export function DownloadButton({ isDownloading, disabled, onDownload, tooltip }: DownloadButtonProps) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={isDownloading || disabled} className="size-7">
              {isDownloading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
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

// Copy All Button
interface CopyAllButtonProps {
  disabled: boolean;
  onCopy: () => Promise<void>;
  tooltip: string;
}

export function CopyAllButton({ disabled, onCopy, tooltip }: CopyAllButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await onCopy();
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard write may fail silently
    }
  }, [onCopy]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          disabled={disabled}
          className="size-7"
        >
          {copied ? (
            <Check className="size-3.5 text-green-500" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// AI Button
interface AIButtonProps {
  isAvailable: boolean | null;
  disabled: boolean;
  onClick: () => void;
  tooltip: string;
  unavailableTooltip: string;
}

export function AIButton({
  isAvailable,
  disabled,
  onClick,
  tooltip,
  unavailableTooltip,
}: AIButtonProps) {
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

// Clear Button
interface ClearButtonProps {
  disabled: boolean;
  onClick: () => void;
  tooltip: string;
}

export function ClearButton({ disabled, onClick, tooltip }: ClearButtonProps) {
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
