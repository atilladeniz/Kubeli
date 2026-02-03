"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LogEntry } from "@/lib/types";
import { LogLine } from "./LogLine";

interface LogContentProps {
  logs: LogEntry[];
  isLoading: boolean;
  searchQuery: string;
  showTimestamps: boolean;
  useRegex: boolean;
  searchRegex: RegExp | null;
  onScroll: () => void;
  onStartStream: () => void;
  /** Disables the Follow button in empty state (e.g., when viewing previous logs) */
  streamDisabled?: boolean;
  /** Ref for scroll-to-bottom target (placed at end of logs) */
  endRef?: React.RefObject<HTMLDivElement | null>;
  // i18n
  loadingText: string;
  searchingText: string;
  noLogsText: string;
  followText: string;
}

/**
 * Main content area for displaying log lines.
 * Handles empty states, loading, and scrolling.
 */
export const LogContent = forwardRef<HTMLDivElement, LogContentProps>(
  function LogContent(
    {
      logs,
      isLoading,
      searchQuery,
      showTimestamps,
      useRegex,
      searchRegex,
      onScroll,
      onStartStream,
      streamDisabled,
      endRef,
      loadingText,
      searchingText,
      noLogsText,
      followText,
    },
    ref
  ) {
    if (logs.length === 0) {
      return (
        <div className="flex-1 overflow-auto font-mono text-sm">
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            {isLoading ? (
              <>
                <Loader2 className="size-8 animate-spin" />
                <p>{loadingText}</p>
              </>
            ) : searchQuery ? (
              <p>{searchingText}</p>
            ) : (
              <>
                <p>{noLogsText}</p>
                {!streamDisabled && (
                  <Button variant="link" onClick={onStartStream} className="text-primary">
                    {followText}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} onScroll={onScroll} className="flex-1 overflow-auto font-mono text-sm">
        <div className="p-2">
          {logs.map((log, index) => (
            <LogLine
              key={`${log.timestamp}-${index}`}
              log={log}
              showTimestamp={showTimestamps}
              searchQuery={searchQuery}
              useRegex={useRegex}
              searchRegex={searchRegex}
            />
          ))}
          {/* Scroll target for auto-scroll */}
          {endRef && <div ref={endRef} />}
        </div>
      </div>
    );
  }
);
