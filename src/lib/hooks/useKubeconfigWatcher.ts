import { useEffect, useRef, useCallback } from "react";
import { useClusterStore } from "../stores/cluster-store";
import { getKubeconfigSources } from "../tauri/commands";

/**
 * Watches configured kubeconfig source paths (files and folders) for filesystem changes.
 * Also watches parent directories so that file renames, additions, and deletions are detected.
 * Falls back to watching ~/.kube/ when no sources are configured.
 * Automatically refreshes the cluster list when kubeconfig files change.
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
      const { homeDir } = await import("@tauri-apps/api/path");
      const config = await getKubeconfigSources();
      const sourcePaths = config.sources.map((s) => s.path);

      // Collect unique parent directories of file sources so we detect
      // renames/additions in those directories (not just modifications)
      const watchPaths = new Set<string>();

      for (const source of config.sources) {
        // Always watch the source itself (file or folder)
        watchPaths.add(source.path);

        // For file sources, also watch the parent directory
        if (source.source_type === "file") {
          const lastSep = Math.max(
            source.path.lastIndexOf("/"),
            source.path.lastIndexOf("\\"),
          );
          if (lastSep > 0) {
            watchPaths.add(source.path.substring(0, lastSep));
          }
        }
      }

      // If no sources configured, watch the default ~/.kube/ directory
      if (sourcePaths.length === 0) {
        try {
          const home = await homeDir();
          watchPaths.add(`${home}.kube`);
        } catch {
          // homeDir may fail outside Tauri
        }
      }

      if (watchPaths.size === 0) return;

      // Watch each path separately: one denied/missing path (e.g. outside
      // the fs scope) must not take down the watchers for the others.
      const results = await Promise.allSettled(
        Array.from(watchPaths).map((path) =>
          watch(path, () => fetchClusters(), { recursive: false, delayMs: 2000 }),
        ),
      );

      const unwatchers = results
        .filter((r): r is PromiseFulfilledResult<() => void> => r.status === "fulfilled")
        .map((r) => r.value);
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.warn(`Kubeconfig watch failed for ${Array.from(watchPaths)[i]}:`, r.reason);
        }
      });

      unwatchRef.current = () => unwatchers.forEach((u) => u());
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
