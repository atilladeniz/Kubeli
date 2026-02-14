import { useEffect } from "react";

/**
 * Blocks the native browser context menu globally,
 * except on custom context-menu triggers, input/textarea elements,
 * and elements marked with data-allow-context-menu.
 */
export function useContextMenuBlocker() {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Allow context menu on our custom context menu triggers
      if (target.closest('[data-slot="context-menu-trigger"]')) {
        return;
      }
      // Allow context menu on input/textarea for copy/paste
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }
      // Allow context menu in areas marked with data-allow-context-menu (e.g., AI chat)
      if (target.closest('[data-allow-context-menu]')) {
        return;
      }
      e.preventDefault();
    };

    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);
}
