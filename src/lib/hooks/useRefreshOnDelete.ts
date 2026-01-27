import { useEffect, useRef } from "react";
import { useUIStore } from "@/lib/stores/ui-store";

/**
 * Hook that triggers a refresh callback when a resource is deleted from the detail panel.
 * Uses a trigger counter from UIStore to detect deletions.
 *
 * @param refresh - The refresh function to call when a deletion is detected
 * @param enabled - Optional flag to enable/disable the hook (default: true)
 */
export function useRefreshOnDelete(refresh: () => void, enabled = true) {
  const resourceDeleteTrigger = useUIStore((state) => state.resourceDeleteTrigger);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the initial render to avoid unnecessary refresh on mount
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (enabled) {
      refresh();
    }
  }, [resourceDeleteTrigger, refresh, enabled]);
}
