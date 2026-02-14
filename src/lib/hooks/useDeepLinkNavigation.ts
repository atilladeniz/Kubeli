import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTabTitle } from "@/components/layout/tabbar/TabBar";
import { useTabsStore } from "@/lib/stores/tabs-store";
import type { ResourceType } from "@/components/layout/sidebar/Sidebar";

/**
 * Listens for deep-link navigation events (kubeli://view/<resource-type>)
 * emitted by the Tauri backend, and navigates the current tab accordingly.
 */
export function useDeepLinkNavigation() {
  const getTabTitle = useTabTitle();

  useEffect(() => {
    const unlisten = listen<{ view: string }>("navigate", (event) => {
      const view = event.payload.view as ResourceType;
      if (view) {
        useTabsStore.getState().navigateCurrentTab(view, getTabTitle(view));
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [getTabTitle]);
}
