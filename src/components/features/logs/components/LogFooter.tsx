"use client";

import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogFooterProps {
  filteredCount: number;
  totalCount: number;
  isFiltered: boolean;
  showScrollButton: boolean;
  onScrollToBottom: () => void;
  autoScrollLabel: string;
}

/**
 * Footer component showing log count and scroll-to-bottom button.
 * Button has fade transition to prevent flicker on scroll.
 */
export function LogFooter({
  filteredCount,
  totalCount,
  isFiltered,
  showScrollButton,
  onScrollToBottom,
  autoScrollLabel,
}: LogFooterProps) {
  return (
    <>
      {/* Scroll to bottom button - always rendered, visibility controlled via opacity */}
      <Button
        onClick={onScrollToBottom}
        className={cn(
          "absolute bottom-12 right-4 shadow-lg z-10 transition-opacity duration-200",
          showScrollButton ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        size="sm"
      >
        <ArrowDown className="size-4" />
        {autoScrollLabel}
      </Button>

      {/* Log count */}
      <div className="border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
        {filteredCount} of {totalCount} lines
        {isFiltered && " (filtered)"}
      </div>
    </>
  );
}
