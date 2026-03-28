"use client";

import { SlidersHorizontal, WrapText, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TimestampMode } from "../../types";

interface DisplayOptionsPopoverProps {
  lineWrap: boolean;
  onLineWrapChange: (checked: boolean) => void;
  logColoring: boolean;
  onLogColoringChange: (checked: boolean) => void;
  timestampMode: TimestampMode;
  onTimestampModeChange: (mode: TimestampMode) => void;
  // i18n
  displayOptionsLabel: string;
  lineWrapLabel: string;
  logColoringLabel: string;
  timestampLabel: string;
  timestampOffLabel: string;
  timestampUtcLabel: string;
  timestampLocalLabel: string;
}

const TIMESTAMP_MODES: TimestampMode[] = ["off", "utc", "local"];

export function DisplayOptionsPopover({
  lineWrap,
  onLineWrapChange,
  logColoring,
  onLogColoringChange,
  timestampMode,
  onTimestampModeChange,
  displayOptionsLabel,
  lineWrapLabel,
  logColoringLabel,
  timestampLabel,
  timestampOffLabel,
  timestampUtcLabel,
  timestampLocalLabel,
}: DisplayOptionsPopoverProps) {
  const timestampLabels: Record<TimestampMode, string> = {
    off: timestampOffLabel,
    utc: timestampUtcLabel,
    local: timestampLocalLabel,
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 shrink-0">
          <SlidersHorizontal className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-3">
        {/* Display Options */}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {displayOptionsLabel}
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
              {lineWrapLabel}
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
              {logColoringLabel}
            </Label>
          </div>
        </div>

        {/* Timestamp */}
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {timestampLabel}
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
                {timestampLabels[mode]}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
