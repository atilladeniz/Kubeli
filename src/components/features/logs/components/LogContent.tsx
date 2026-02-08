"use client";

import { forwardRef, useState, useCallback, useRef, useEffect } from "react";
import { Loader2, Copy, Check } from "lucide-react";
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
  copyLabel: string;
  copiedLabel: string;
}

/**
 * Main content area for displaying log lines.
 * Handles empty states, loading, and scrolling.
 *
 * Uses a custom context menu (no Radix portal) so that focus stays
 * in the text area and the native browser selection remains visible
 * while the menu is open.
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
      copyLabel,
      copiedLabel,
    },
    ref
  ) {
    const menuRef = useRef<HTMLDivElement>(null);
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
    const [contextMenuSelection, setContextMenuSelection] = useState("");
    const [copied, setCopied] = useState(false);

    // Show custom context menu on right-click when text is selected
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
      const sel = window.getSelection();
      const text = sel?.toString() ?? "";
      if (!text) return; // No selection → allow default behavior

      e.preventDefault();
      // Reset stale "copied" state from a previous copy
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      setCopied(false);
      setContextMenuSelection(text);
      setMenuPos({ x: e.clientX, y: e.clientY });
    }, []);

    // Close menu on outside click, escape, or scroll
    useEffect(() => {
      if (!menuPos) return;

      const handleMouseDown = (e: MouseEvent) => {
        if (menuRef.current?.contains(e.target as Node)) return;
        setMenuPos(null);
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setMenuPos(null);
      };

      window.addEventListener("mousedown", handleMouseDown);
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("mousedown", handleMouseDown);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [menuPos]);

    const handleCopy = useCallback(async () => {
      if (!contextMenuSelection) return;
      try {
        await navigator.clipboard.writeText(contextMenuSelection);
        setCopied(true);
        copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
      } catch {
        // Fallback: already handled by browser
      }
      setMenuPos(null);
    }, [contextMenuSelection]);

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
      <>
        <div
          ref={ref}
          onScroll={onScroll}
          onContextMenu={handleContextMenu}
          className="flex-1 overflow-auto"
        >
          <pre className="m-0 p-2 font-mono text-sm leading-5" data-allow-context-menu>
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
            {endRef && <span ref={endRef as React.RefObject<HTMLSpanElement>} />}
          </pre>
        </div>

        {/* Custom context menu — no portal/focus-steal so selection stays visible */}
        {menuPos && (
          <div
            ref={menuRef}
            className="bg-popover text-popover-foreground fixed z-50 min-w-[8rem] rounded-md border p-1 shadow-md"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            <button
              onClick={handleCopy}
              disabled={!contextMenuSelection}
              className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none disabled:pointer-events-none disabled:opacity-50"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? copiedLabel : copyLabel}
            </button>
          </div>
        )}
      </>
    );
  }
);
