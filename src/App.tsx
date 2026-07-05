import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { usePortForwardStore } from "@/lib/stores/portforward-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { applyProxyFromSettings } from "@/lib/tauri/commands/network";
import { useKubeconfigWatcher } from "@/lib/hooks/useKubeconfigWatcher";
import { useStartupDeepLinks } from "@/lib/hooks/useStartupDeepLinks";
import { HomePage } from "@/components/features/home";

// The dashboard (and everything it pulls in: Monaco, the diagram stack, AI
// chat) only renders after a cluster connection — keep it out of the startup
// bundle so first paint ships the home page alone.
const Dashboard = lazy(() =>
  import("@/components/features/dashboard").then((m) => ({ default: m.Dashboard }))
);

function checkIsTauri(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.VITE_TAURI_MOCK === "true") {
    return true;
  }
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

export default function Home() {
  const [isReady, setIsReady] = useState(false);
  const [isTauri, setIsTauri] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const initialFetchDone = useRef(false);

  // Watch kubeconfig for filesystem changes (new/modified/deleted files)
  useKubeconfigWatcher();

  // Dispatch any deep link that launched the app (cold start), once Tauri is ready
  useStartupDeepLinks(isTauri);

  const isConnected = useClusterStore((s) => s.isConnected);
  const fetchClusters = useClusterStore((s) => s.fetchClusters);
  const connect = useClusterStore((s) => s.connect);

  // Initialize app: detect Tauri, then stream the cluster list in. isReady is
  // set before fetchClusters resolves — first paint must not wait on disk I/O
  // and kubeconfig parsing; HomePage gates its empty state on
  // hasFetchedClusters instead.
  useEffect(() => {
    const initialize = async () => {
      const tauriAvailable = checkIsTauri();
      if (!tauriAvailable) {
        // Tauri bridge might not be ready immediately on first load
        await new Promise((resolve) => setTimeout(resolve, 50));
        const retryCheck = checkIsTauri();
        setIsTauri(retryCheck);
        if (!retryCheck) {
          setIsReady(true);
          return;
        }
      } else {
        setIsTauri(true);
      }

      setIsReady(true);

      if (!initialFetchDone.current) {
        initialFetchDone.current = true;
        // Re-apply persisted proxy settings before the first cluster connection
        const { settings } = useUIStore.getState();
        if (settings.proxyType !== "none") {
          await applyProxyFromSettings(settings).catch((e) =>
            console.error("Failed to apply proxy config on startup:", e)
          );
        }
        await fetchClusters();
      }
    };

    initialize();
  }, [fetchClusters]);

  // Listen for deep-link auto-connect events (kubeli://connect/<context>)
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<{ context: string }>("auto-connect", async (event) => {
        const ctx = event.payload.context;
        if (ctx) {
          await fetchClusters();
          await connect(ctx);
        }
      }).then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      });
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [isTauri, fetchClusters, connect]);

  // Restart long-running connections after OIDC token refresh
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("oidc-token-refreshed", async () => {
        const pfStore = usePortForwardStore.getState();
        const activeForwards = pfStore.forwards.filter((f) => f.status === "connected");
        for (const fwd of activeForwards) {
          // Per-forward try/catch so one failure doesn't strand the rest.
          try {
            await pfStore.stopForward(fwd.forward_id);
            await pfStore.startForward(
              fwd.namespace,
              fwd.name,
              fwd.target_type,
              fwd.target_port,
              fwd.local_port,
              fwd.port_name
            );
          } catch (err) {
            console.error(`Failed to restart port-forward ${fwd.forward_id} after OIDC refresh`, err);
          }
        }
        const clusterStore = useClusterStore.getState();
        if (clusterStore.namespaceSource === "auto") {
          await clusterStore.stopNamespaceWatch();
          await clusterStore.startNamespaceWatch();
        }
      })
        .then((fn) => {
          if (cancelled) fn();
          else unlisten = fn;
        })
        .catch((err) => {
          console.error("Failed to register oidc-token-refreshed listener", err);
        });
    }).catch((err) => {
      console.error("Failed to load Tauri event module for OIDC refresh", err);
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [isTauri]);

  // Disable native context menu globally
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Allow context menu in areas that explicitly opt in
      if (target.closest("[data-allow-context-menu]")) {
        return;
      }
      // Allow context menu on inputs for copy/paste
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }
      e.preventDefault();
    };

    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  // Prevent app-wide Select All; keep Cmd/Ctrl+A only for editable targets.
  // For [data-allow-context-menu] containers (e.g. logs), scope selection to
  // that container only so multiple log panels don't cross-select.
  useEffect(() => {
    const handleSelectAll = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "a") return;
      if (e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (!target) { e.preventDefault(); return; }

      // Allow default for native editable elements
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (target.isContentEditable || target.closest('[contenteditable="true"]')) return;
      if (target.closest('[role="textbox"]')) return;

      // Scope selection to the closest [data-allow-context-menu] container
      const container = target.closest('[data-allow-context-menu]');
      if (container) {
        e.preventDefault();
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(container);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        return;
      }

      e.preventDefault();
    };

    document.addEventListener("keydown", handleSelectAll, true);
    return () => document.removeEventListener("keydown", handleSelectAll, true);
  }, []);

  // Show dashboard when connected (latch: stays true for instant reconnect)
  useEffect(() => {
    if (isConnected) {
      setShowDashboard(true);
    }
  }, [isConnected]);

  if (showDashboard && isConnected) {
    return (
      // Keep the home page visible while the dashboard chunk loads — a blank
      // flash here would read as a crash right after connecting.
      <Suspense fallback={<HomePage isTauri={isTauri} isReady={isReady} />}>
        <Dashboard />
      </Suspense>
    );
  }

  return <HomePage isTauri={isTauri} isReady={isReady} />;
}
