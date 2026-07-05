"use client";

import { forwardRef, useState, useCallback, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2, Copy, Check, Sparkles, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LogEntry } from "@/lib/types";
import { LogLine } from "./LogLine";

interface LogContentProps {
  logs: LogEntry[];
  isLoading: boolean;
  searchQuery: string;
  showTimestamps: boolean;
  timestampLocal?: boolean;
  lineWrap?: boolean;
  logColoring?: boolean;
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
  onSendToAI?: (text: string) => void;
  sendToAILabel?: string;
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
      timestampLocal,
      lineWrap,
      logColoring,
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
      onSendToAI,
      sendToAILabel,
    },
    ref
  ) {
    const menuRef = useRef<HTMLDivElement>(null);
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
    const [contextMenuSelection, setContextMenuSelection] = useState("");
    const [copied, setCopied] = useState(false);

    // Internal ref for the virtualizer; merged with the forwarded ref so the
    // parent's scroll-position save/restore keeps working on the same element.
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const setScrollRef = useCallback(
      (node: HTMLDivElement | null) => {
        scrollRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );

    // React Compiler skips memoizing this component because useVirtualizer
    // returns unmemoizable functions; line children stay memoized via LogLine.
    // eslint-disable-next-line react-hooks/incompatible-library
    const virtualizer = useVirtualizer({
      count: logs.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => 20, // leading-5 = 20px
      overscan: 20,
    });

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
              <>
                <SearchX className="size-8" />
                <p className="px-4 text-center">{searchingText}</p>
              </>
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
          ref={setScrollRef}
          tabIndex={0}
          onScroll={onScroll}
          onContextMenu={handleContextMenu}
          className="flex-1 overflow-auto p-2 outline-none"
          data-allow-context-menu
        >
          <pre
            className={`relative m-0 font-mono text-sm leading-5 ${lineWrap ? "whitespace-pre-wrap break-words" : ""}`}
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const log = logs[item.index];
              return (
                <div
                  key={log.seq ?? item.index}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <LogLine
                    log={log}
                    showTimestamp={showTimestamps}
                    timestampLocal={timestampLocal}
                    logColoring={logColoring}
                    searchQuery={searchQuery}
                    useRegex={useRegex}
                    searchRegex={searchRegex}
                  />
                </div>
              );
            })}
          </pre>
          {/* Scroll target for auto-scroll (after the total-height container) */}
          {endRef && <span ref={endRef as React.RefObject<HTMLSpanElement>} />}
        </div>

        {/* Custom context menu — no portal/focus-steal so selection stays visible */}
        {menuPos && (
          <div
            ref={menuRef}
            className="opaque-popover bg-popover text-popover-foreground fixed z-50 min-w-[8rem] rounded-md border p-1 shadow-md"
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
            {onSendToAI && (
              <>
                <div className="bg-border -mx-1 my-1 h-px" />
                <button
                  onClick={() => {
                    onSendToAI(contextMenuSelection);
                    setMenuPos(null);
                  }}
                  disabled={!contextMenuSelection}
                  className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none disabled:pointer-events-none disabled:opacity-50"
                >
                  <Sparkles className="size-3.5" />
                  {sendToAILabel}
                </button>
              </>
            )}
          </div>
        )}
      </>
    );
  }
);
