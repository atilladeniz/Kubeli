"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { LOG_DEFAULTS } from "../types";

interface UseAutoScrollOptions {
  /** Dependency array that triggers scroll (e.g., logs array) */
  dependencies: unknown[];
  /** Initial scroll position to restore */
  initialScrollTop?: number;
  /** Initial autoScroll state (persisted from previous session) */
  initialAutoScroll?: boolean;
  /** Whether the view already has logs from a previous session (skip initial auto-scroll) */
  isResuming?: boolean;
  /** Callback when scroll position changes (debounced) */
  onScrollTopChange?: (scrollTop: number) => void;
  /** Callback when autoScroll state changes */
  onAutoScrollChange?: (autoScroll: boolean) => void;
}

interface UseAutoScrollReturn {
  /** Ref callback for the scrollable container */
  containerRef: (node: HTMLDivElement | null) => void;
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
export function useAutoScroll({ dependencies, initialScrollTop, initialAutoScroll = true, isResuming, onScrollTopChange, onAutoScrollChange }: UseAutoScrollOptions): UseAutoScrollReturn {
  const [autoScroll, setAutoScrollState] = useState(initialAutoScroll);
  const containerNodeRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guard: ignore scroll events caused by programmatic scrolling
  const suppressScrollHandlerRef = useRef(false);

  // Wrap setAutoScroll to also persist to store
  const setAutoScroll = useCallback((value: boolean) => {
    setAutoScrollState(value);
    onAutoScrollChange?.(value);
  }, [onAutoScrollChange]);

  // Callback ref: fires synchronously during commit when DOM node is attached.
  // Restores scroll position before the browser paints — no flicker.
  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerNodeRef.current = node;
      if (node && isResuming) {
        suppressScrollHandlerRef.current = true;
        if (initialScrollTop && initialScrollTop > 0) {
          node.scrollTop = initialScrollTop;
        }
        requestAnimationFrame(() => {
          suppressScrollHandlerRef.current = false;
        });
      }
    },
    // Stable across renders — only needs initial values
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Scroll the container to its bottom edge directly via scrollTop.
  // This is more reliable than scrollIntoView in deeply nested flex layouts
  // (e.g. detail pane) where scrollIntoView can target the wrong ancestor.
  const scrollToEnd = useCallback((behavior: ScrollBehavior) => {
    const node = containerNodeRef.current;
    if (!node) return;
    suppressScrollHandlerRef.current = true;
    node.scrollTo({ top: node.scrollHeight, behavior });
    requestAnimationFrame(() => {
      suppressScrollHandlerRef.current = false;
    });
  }, []);

  // Auto-scroll to bottom when dependencies change (skip first render when resuming)
  const skipNextScrollRef = useRef(isResuming);
  useEffect(() => {
    if (skipNextScrollRef.current) {
      skipNextScrollRef.current = false;
      return;
    }
    if (!autoScroll) return;
    // rAF ensures containerNodeRef is set after a logs empty→non-empty DOM transition
    requestAnimationFrame(() => {
      scrollToEnd("instant");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScroll, ...dependencies]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (!containerNodeRef.current) return;
    if (suppressScrollHandlerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerNodeRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < LOG_DEFAULTS.SCROLL_THRESHOLD;
    setAutoScroll(isAtBottom);

    if (onScrollTopChange) {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
      scrollDebounceRef.current = setTimeout(() => {
        onScrollTopChange(scrollTop);
      }, 300);
    }
  }, [onScrollTopChange, setAutoScroll]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    };
  }, []);

  // Manual scroll-to-bottom button — uses smooth animation
  const scrollToBottom = useCallback(() => {
    if (!containerNodeRef.current) return;
    scrollToEnd("smooth");
    setTimeout(() => {
      setAutoScroll(true);
    }, 300);
  }, [scrollToEnd, setAutoScroll]);

  return {
    containerRef,
    endRef,
    autoScroll,
    setAutoScroll,
    scrollToBottom,
    handleScroll,
  };
}
