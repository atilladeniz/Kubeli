import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTabsStore } from "@/lib/stores/tabs-store";
import type { ResourceType } from "@/components/layout/Sidebar";

/**
 * Listens for deep-link navigation events (kubeli://view/<resource-type>)
 * emitted by the Tauri backend, and navigates the current tab accordingly.
 */
export function useDeepLinkNavigation() {
  useEffect(() => {
    const unlisten = listen<{ view: string }>("navigate", (event) => {
      const view = event.payload.view as ResourceType;
      if (view) {
        // Format title from slug: "pods" -> "Pods", "cluster-overview" -> "Cluster Overview"
        const title = view
          .split("-")
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        useTabsStore.getState().navigateCurrentTab(view, title);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
