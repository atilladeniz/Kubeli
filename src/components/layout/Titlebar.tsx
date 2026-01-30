"use client";

import { useEffect } from "react";
import { Settings, Sparkles, Loader2, CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useUpdater } from "@/lib/hooks/useUpdater";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePlatform } from "@/lib/hooks/usePlatform";

interface TitlebarProps {
  title?: string;
  showTitle?: boolean;
  isAIOpen?: boolean;
  isAIProcessing?: boolean;
  isAIDisabled?: boolean;
  onToggleAI?: () => void;
  onOpenSettings?: () => void;
  onOpenShortcutsHelp?: () => void;
}

export function Titlebar({ isAIOpen, isAIProcessing, isAIDisabled, onToggleAI, onOpenSettings, onOpenShortcutsHelp }: TitlebarProps) {
  const { modKeySymbol } = usePlatform();
  const tu = useTranslations("updates");
  const { available, update, downloading, progress, readyToRestart, downloadComplete, downloadAndInstall, restartNow } = useUpdater();
  useEffect(() => {
    // Disable native context menu globally
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Allow context menu on our custom context menu triggers
      if (target.closest('[data-slot="context-menu-trigger"]')) {
        return;
      }
      // Allow context menu on input/textarea for copy/paste
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }
      // Allow context menu in areas marked with data-allow-context-menu (e.g., AI chat)
      if (target.closest('[data-allow-context-menu]')) {
        return;
      }
      e.preventDefault();
    };

    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  return (
    <div data-tauri-drag-region className="h-7 shrink-0 flex items-center justify-end px-2 gap-1">
      {/* Update Button */}
      {available && update && (
        <Button
          variant="default"
          size="sm"
          className="h-5 text-[10px] px-2 py-0"
          onClick={() => (readyToRestart || downloadComplete) ? restartNow() : downloadAndInstall()}
          disabled={downloading}
        >
          {downloading ? `${Math.round(progress)}%` : (readyToRestart || downloadComplete) ? tu("restartNow") : tu("updateNow")}
        </Button>
      )}

      {/* AI Assistant Button */}
      {onToggleAI && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isAIOpen ? "secondary" : "ghost"}
                size="icon"
                className={cn(
                  "size-6",
                  isAIOpen && "bg-primary/10 text-primary hover:bg-primary/20",
                  !isAIOpen && isAIProcessing && "text-violet-500",
                  isAIDisabled && "opacity-50 cursor-not-allowed"
                )}
                onClick={isAIDisabled ? undefined : onToggleAI}
                disabled={isAIDisabled}
              >
                {!isAIOpen && isAIProcessing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex items-center gap-2">
              {isAIDisabled ? (
                <span className="text-muted-foreground">AI CLI not installed</span>
              ) : (
                <>
                  <span>AI Assistant</span>
                  <Kbd className="text-[10px]">G I</Kbd>
                </>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Shortcuts Help Button */}
      {onOpenShortcutsHelp && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={onOpenShortcutsHelp}
              >
                <CircleHelp className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex items-center gap-2">
              <span>Keyboard Shortcuts</span>
              <Kbd className="text-[10px]">?</Kbd>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Settings Button */}
      {onOpenSettings && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={onOpenSettings}
              >
                <Settings className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex items-center gap-2">
              <span>Settings</span>
              <Kbd className="text-[10px]">{modKeySymbol},</Kbd>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
