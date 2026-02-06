import { useEffect, useRef, useCallback } from "react";
import { useClusterStore } from "../stores/cluster-store";
import { getKubeconfigSources } from "../tauri/commands";

/**
 * Watches configured kubeconfig source paths (files and folders) for filesystem changes.
 * Automatically refreshes the cluster list when kubeconfig files are added, modified, or removed.
 */
export function useKubeconfigWatcher() {
  const fetchClusters = useClusterStore((s) => s.fetchClusters);
  const unwatchRef = useRef<(() => void) | null>(null);

  const setupWatcher = useCallback(async () => {
    // Clean up previous watcher
    if (unwatchRef.current) {
      unwatchRef.current();
      unwatchRef.current = null;
    }

    // Skip in mock/web-dev mode
    if (process.env.VITE_TAURI_MOCK === "true") {
      return;
    }

    try {
      const { watch } = await import("@tauri-apps/plugin-fs");
      const config = await getKubeconfigSources();
      const paths = config.sources.map((s) => s.path);

      if (paths.length === 0) return;

      const unwatch = await watch(
        paths,
        () => {
          fetchClusters();
        },
        { recursive: false, delayMs: 2000 }
      );

      unwatchRef.current = unwatch;
    } catch (e) {
      console.error("Failed to setup kubeconfig watcher:", e);
    }
  }, [fetchClusters]);

  useEffect(() => {
    setupWatcher();

    // Restart watcher when sources are added/removed in settings
    const handleSourcesChanged = () => setupWatcher();
    window.addEventListener("kubeconfig-sources-changed", handleSourcesChanged);

    return () => {
      window.removeEventListener("kubeconfig-sources-changed", handleSourcesChanged);
      if (unwatchRef.current) {
        unwatchRef.current();
        unwatchRef.current = null;
      }
    };
  }, [setupWatcher]);

  return { restartWatcher: setupWatcher };
}
