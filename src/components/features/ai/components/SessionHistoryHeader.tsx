"use client";

import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SessionHistoryHeaderProps {
  title: string;
  refreshLabel: string;
  newSessionLabel: string;
  loading: boolean;
  onRefresh: () => void;
  onNewSession: () => void;
}

const pointerStyle = { cursor: "pointer" } as const;

/**
 * Header for the session history panel with refresh and new session buttons.
 */
export function SessionHistoryHeader({
  title,
  refreshLabel,
  newSessionLabel,
  loading,
  onRefresh,
  onNewSession,
}: SessionHistoryHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b bg-background/50">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {title}
      </span>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              style={pointerStyle}
              onClick={onRefresh}
              disabled={loading}
            >
              <RotateCcw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{refreshLabel}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-primary"
              style={pointerStyle}
              onClick={onNewSession}
            >
              <Plus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{newSessionLabel}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
