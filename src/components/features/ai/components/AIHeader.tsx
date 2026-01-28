"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles, History, PanelLeftClose, X } from "lucide-react";
import { ProviderBadge } from "./ProviderBadge";

interface AIHeaderProps {
  title: string;
  clusterContext: string;
  showHistory: boolean;
  isSessionActive: boolean;
  onToggleHistory: () => void;
  onStopSession: () => void;
  onClose: () => void;
  stopLabel: string;
}

/**
 * Header bar for the AI Assistant panel.
 */
export function AIHeader({
  title,
  clusterContext,
  showHistory,
  isSessionActive,
  onToggleHistory,
  onStopSession,
  onClose,
  stopLabel,
}: AIHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
          <Sparkles className="size-3.5" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold leading-tight">{title}</h3>
            <ProviderBadge />
          </div>
          <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">
            {clusterContext}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleHistory}
          className={cn(
            "size-7 cursor-pointer transition-colors",
            showHistory
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {showHistory ? (
            <PanelLeftClose className="size-3.5" />
          ) : (
            <History className="size-3.5" />
          )}
        </Button>
        {isSessionActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onStopSession}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {stopLabel}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
