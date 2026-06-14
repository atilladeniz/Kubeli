import { useEffect, useRef } from "react";
import { useTabTitle } from "@/components/layout/tabbar";
import { useTabsStore } from "@/lib/stores/tabs-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { takeStartupDeepLinks, type DeepLinkAction } from "@/lib/tauri/commands";
import type { ResourceType } from "@/components/layout/sidebar/Sidebar";

/**
 * Drains deep links that arrived during a cold start — before the live
 * `navigate`/`auto-connect` listeners were mounted — and dispatches them through
 * the same store actions those listeners use. Runs once when Tauri is ready.
 *
 * Warm deep links (received while the app runs) still flow through the live
 * listeners; this only covers the launch-time gap the backend buffers.
 */
export function useStartupDeepLinks(enabled: boolean) {
  const getTabTitle = useTabTitle();
  const drained = useRef(false);

  useEffect(() => {
    if (!enabled || drained.current) return;
    drained.current = true;
    let cancelled = false;

    (async () => {
      let actions: DeepLinkAction[];
      try {
        actions = await takeStartupDeepLinks();
      } catch {
        return; // best-effort; nothing to drain (e.g. web/mock mode)
      }
      for (const action of actions) {
        if (cancelled) return;
        if (action.kind === "navigate") {
          const view = action.view as ResourceType;
          useTabsStore.getState().navigateCurrentTab(view, getTabTitle(view));
        } else if (action.kind === "connect") {
          const { fetchClusters, connect } = useClusterStore.getState();
          await fetchClusters();
          await connect(action.context);
        }
        // oidc_callback: a cold start has no in-flight auth to complete — ignore.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, getTabTitle]);
}
