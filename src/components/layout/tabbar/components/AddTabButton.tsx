"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AddTabButtonProps {
  isAtLimit: boolean;
  modKeySymbol: string;
  newTabLabel: string;
  limitReachedLabel: string;
  onClick: () => void;
}

export function AddTabButton({
  isAtLimit,
  modKeySymbol,
  newTabLabel,
  limitReachedLabel,
  onClick,
}: AddTabButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={isAtLimit}
            className={cn(
              "shrink-0 rounded-md p-1.5 transition-colors",
              isAtLimit
                ? "text-muted-foreground/30 cursor-not-allowed"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Plus className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex items-center gap-2">
          <span>{isAtLimit ? limitReachedLabel : newTabLabel}</span>
          {!isAtLimit && <Kbd className="text-[10px]">{modKeySymbol}T</Kbd>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
