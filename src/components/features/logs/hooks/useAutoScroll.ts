"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { LOG_DEFAULTS } from "../types";

interface UseAutoScrollOptions {
  /** Dependency array that triggers scroll (e.g., logs array) */
  dependencies: unknown[];
}

interface UseAutoScrollReturn {
  /** Ref for the scrollable container */
  containerRef: React.RefObject<HTMLDivElement | null>;
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
export function useAutoScroll({ dependencies }: UseAutoScrollOptions): UseAutoScrollReturn {
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when dependencies change
  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScroll, ...dependencies]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < LOG_DEFAULTS.SCROLL_THRESHOLD;
    setAutoScroll(isAtBottom);
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
    endRef,
    autoScroll,
    setAutoScroll,
    scrollToBottom,
    handleScroll,
  };
}
