"use client";

import { useEffect, useCallback, useState } from "react";

type ShortcutHandler = () => void;

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: ShortcutHandler;
  description: string;
  /** If true, shortcut works even when input is focused */
  global?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
}

/**
 * Hook for handling keyboard shortcuts with support for sequences like "g p"
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true } = options;
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Skip if typing in input/textarea (unless global)
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        if (isInput && !shortcut.global) continue;

        const keys = shortcut.key.split(" ");

        // Handle key sequences (e.g., "g p")
        if (keys.length === 2) {
          if (pendingKey === keys[0] && event.key.toLowerCase() === keys[1]) {
            event.preventDefault();
            shortcut.handler();
            setPendingKey(null);
            return;
          }
          if (event.key.toLowerCase() === keys[0] && !pendingKey) {
            setPendingKey(keys[0]);
            // Clear pending after 1 second
            setTimeout(() => setPendingKey(null), 1000);
            return;
          }
        }

        // Handle single key shortcuts
        if (keys.length === 1) {
          const matchesKey = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
            event.key === shortcut.key;
          const matchesCtrl = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
          const matchesMeta = shortcut.meta ? event.metaKey : !event.metaKey;
          // For non-alphanumeric keys (e.g., "?", "/"), don't enforce shift state
          // since different keyboard layouts may or may not require shift
          const isSymbolKey = /[^a-zA-Z0-9]/.test(shortcut.key);
          const matchesShift = shortcut.shift ? event.shiftKey :
            isSymbolKey ? true : !event.shiftKey;

          if (matchesKey && matchesCtrl && matchesMeta && matchesShift) {
            event.preventDefault();
            shortcut.handler();
            setPendingKey(null);
            return;
          }
        }
      }

      // Clear pending key on any other key
      if (pendingKey && !shortcuts.some(s => s.key.startsWith(pendingKey))) {
        setPendingKey(null);
      }
    },
    [shortcuts, enabled, pendingKey]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { pendingKey };
}

/**
 * Standard navigation shortcuts
 */
export const NAVIGATION_SHORTCUTS = {
  GOTO_PODS: "g p",
  GOTO_DEPLOYMENTS: "g d",
  GOTO_SERVICES: "g s",
  GOTO_NODES: "g n",
  GOTO_OVERVIEW: "g o",
  GOTO_DIAGRAM: "g r",
  GOTO_CONFIGMAPS: "g c",
  GOTO_SECRETS: "g e",
  GOTO_NAMESPACES: "g a",
  FOCUS_SEARCH: "/",
  REFRESH: "r",
  HELP: "?",
  TOGGLE_AI: "g i",
  // Favorite shortcuts (Cmd+1 through Cmd+9)
  FAVORITE_1: "1",
  FAVORITE_2: "2",
  FAVORITE_3: "3",
  FAVORITE_4: "4",
  FAVORITE_5: "5",
  FAVORITE_6: "6",
  FAVORITE_7: "7",
  FAVORITE_8: "8",
  FAVORITE_9: "9",
} as const;
