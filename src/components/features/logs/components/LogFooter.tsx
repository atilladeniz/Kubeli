"use client";

import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          onClick={onScrollToBottom}
          className="absolute bottom-12 right-4 shadow-lg z-10"
          size="sm"
        >
          <ArrowDown className="size-4" />
          {autoScrollLabel}
        </Button>
      )}

      {/* Log count */}
      <div className="border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
        {filteredCount} of {totalCount} lines
        {isFiltered && " (filtered)"}
      </div>
    </>
  );
}
