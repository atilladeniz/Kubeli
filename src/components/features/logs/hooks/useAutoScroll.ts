"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { LOG_DEFAULTS } from "../types";

interface UseAutoScrollOptions {
  /** Dependency array that triggers scroll (e.g., logs array) */
  dependencies: unknown[];
  /** Initial scroll position to restore */
  initialScrollTop?: number;
  /** Whether the view already has logs from a previous session (skip initial auto-scroll) */
  isResuming?: boolean;
  /** Callback when scroll position changes (debounced) */
  onScrollTopChange?: (scrollTop: number) => void;
}

interface UseAutoScrollReturn {
  /** Ref callback for the scrollable container */
  containerRef: (node: HTMLDivElement | null) => void;
  /** Ref for accessing the container DOM node */
  containerNode: HTMLDivElement | null;
  /** Ref for the scroll target element (bottom marker) */
  endRef: React.RefObject<HTMLDivElement | null>;
  /** Whether auto-scroll is enabled */
  autoScroll: boolean;
  /** Set auto-scroll state */
  setAutoScroll: (enabled: boolean) => void;
  /** Scroll to bottom manually */
  scrollToBottom: () => void;
  /** Handle scroll events to detect user scroll position */
  handleScroll: () => void;
}

/**
 * Hook for managing auto-scroll behavior in log viewers.
 * Automatically scrolls to bottom when new content arrives,
 * but pauses when user scrolls up.
 */
export function useAutoScroll({ dependencies, initialScrollTop, isResuming, onScrollTopChange }: UseAutoScrollOptions): UseAutoScrollReturn {
  const [autoScroll, setAutoScroll] = useState(!isResuming);
  const containerNodeRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);

  // Callback ref: fires synchronously during commit when DOM node is attached.
  // Restores scroll position before the browser paints — no flicker.
  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerNodeRef.current = node;
      if (node && isResuming && !hasRestoredRef.current) {
        hasRestoredRef.current = true;
        if (initialScrollTop && initialScrollTop > 0) {
          node.scrollTop = initialScrollTop;
        }
      }
    },
    // Stable across renders — only needs initial values
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Auto-scroll to bottom when dependencies change (skip first render when resuming)
  const skipNextScrollRef = useRef(isResuming);
  useEffect(() => {
    if (skipNextScrollRef.current) {
      skipNextScrollRef.current = false;
      return;
    }
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScroll, ...dependencies]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (!containerNodeRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerNodeRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < LOG_DEFAULTS.SCROLL_THRESHOLD;
    setAutoScroll(isAtBottom);

    if (onScrollTopChange) {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
      scrollDebounceRef.current = setTimeout(() => {
        onScrollTopChange(scrollTop);
      }, 300);
    }
  }, [onScrollTopChange]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    };
  }, []);

  // Scroll to bottom and re-enable auto-scroll after animation completes
  const scrollToBottom = useCallback(() => {
    if (!endRef.current) return;

    endRef.current.scrollIntoView({ behavior: "smooth" });

    // Delay setting autoScroll to avoid button flicker during smooth scroll
    // 300ms matches typical smooth scroll duration
    setTimeout(() => {
      setAutoScroll(true);
    }, 300);
  }, []);

  return {
    containerRef,
    containerNode: containerNodeRef.current,
    endRef,
    autoScroll,
    setAutoScroll,
    scrollToBottom,
    handleScroll,
  };
}
