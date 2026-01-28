"use client";

import { memo } from "react";
import { MessageSquare, Clock, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SessionSummary } from "@/lib/tauri/commands";

interface SessionItemProps {
  session: SessionSummary;
  isActive: boolean;
  isLoading: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  formatTime: (dateStr: string) => string;
  getTitle: (session: SessionSummary) => string;
  messagesLabel: string;
  deleteLabel: string;
}

const pointerStyle = { cursor: "pointer" } as const;

/**
 * Single session item in the history list.
 * Memoized to prevent unnecessary re-renders when other sessions change.
 */
export const SessionItem = memo(function SessionItem({
  session,
  isActive,
  isLoading,
  onSelect,
  onDelete,
  formatTime,
  getTitle,
  messagesLabel,
  deleteLabel,
}: SessionItemProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !isLoading) {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      onClick={() => !isLoading && onSelect()}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={pointerStyle}
      className={cn(
        "w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-all group select-none",
        isActive ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/60",
        isLoading && "opacity-70"
      )}
    >
      {/* Icon */}
      <div
        style={pointerStyle}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md mt-0.5",
          isActive ? "bg-primary/20" : "bg-muted"
        )}
      >
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin text-primary" />
        ) : (
          <MessageSquare
            className={cn(
              "size-3.5",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          />
        )}
      </div>

      {/* Content */}
      <div style={pointerStyle} className="flex-1 min-w-0 space-y-1">
        <p
          style={pointerStyle}
          className={cn(
            "text-xs font-medium truncate leading-tight",
            isActive && "text-primary"
          )}
        >
          {getTitle(session)}
        </p>
        <div style={pointerStyle} className="flex items-center gap-2">
          <span
            style={pointerStyle}
            className="text-[10px] text-muted-foreground flex items-center gap-1"
          >
            <Clock className="size-2.5" />
            {formatTime(session.last_active_at)}
          </span>
          <span
            style={pointerStyle}
            className="text-[10px] text-muted-foreground/70"
          >
            {messagesLabel}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              style={pointerStyle}
              onClick={onDelete}
            >
              <Trash2 className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{deleteLabel}</p>
          </TooltipContent>
        </Tooltip>
        <ChevronRight className="size-3.5 text-muted-foreground/50" />
      </div>
    </div>
  );
});
