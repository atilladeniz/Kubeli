"use client";

import { SlidersHorizontal, WrapText, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TimestampMode } from "../../types";

export interface DisplayOptionsLabels {
  tooltip: string;
  displayOptions: string;
  lineWrap: string;
  logColoring: string;
  timestamp: string;
  timestampOff: string;
  timestampUtc: string;
  timestampLocal: string;
}

interface DisplayOptionsPopoverProps {
  lineWrap: boolean;
  onLineWrapChange: (checked: boolean) => void;
  logColoring: boolean;
  onLogColoringChange: (checked: boolean) => void;
  timestampMode: TimestampMode;
  onTimestampModeChange: (mode: TimestampMode) => void;
  labels: DisplayOptionsLabels;
}

const TIMESTAMP_MODES: TimestampMode[] = ["off", "utc", "local"];

export function DisplayOptionsPopover({
  lineWrap,
  onLineWrapChange,
  logColoring,
  onLogColoringChange,
  timestampMode,
  onTimestampModeChange,
  labels,
}: DisplayOptionsPopoverProps) {
  const timestampModeLabels: Record<TimestampMode, string> = {
    off: labels.timestampOff,
    utc: labels.timestampUtc,
    local: labels.timestampLocal,
  };

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 shrink-0">
              <SlidersHorizontal className="size-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{labels.tooltip}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-56 p-3">
        {/* Display Options */}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {labels.displayOptions}
        </p>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Checkbox
              id="line-wrap"
              checked={lineWrap}
              onCheckedChange={(checked) => onLineWrapChange(checked as boolean)}
              className="size-4"
            />
            <Label htmlFor="line-wrap" className="text-xs cursor-pointer flex items-center gap-1.5 text-foreground">
              <WrapText className="size-3.5 text-muted-foreground" />
              {labels.lineWrap}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="log-coloring"
              checked={logColoring}
              onCheckedChange={(checked) => onLogColoringChange(checked as boolean)}
              className="size-4"
            />
            <Label htmlFor="log-coloring" className="text-xs cursor-pointer flex items-center gap-1.5 text-foreground">
              <Palette className="size-3.5 text-muted-foreground" />
              {labels.logColoring}
            </Label>
          </div>
        </div>

        {/* Divider */}
        <div className="my-3 h-px bg-border" />

        {/* Timestamp */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {labels.timestamp}
          </p>
          <div className="flex rounded-md border border-border overflow-hidden">
            {TIMESTAMP_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onTimestampModeChange(mode)}
                className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
                  timestampMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {timestampModeLabels[mode]}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
