import { useEffect, useState, useRef } from "react";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useKubeconfigWatcher } from "@/lib/hooks/useKubeconfigWatcher";
import { Dashboard } from "@/components/features/dashboard";
import { HomePage } from "@/components/features/home";

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

  const { isConnected, fetchClusters, connect } = useClusterStore();

  // Initialize app: detect Tauri, then fetch clusters before showing UI
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

      // Fetch clusters before showing UI
      if (!initialFetchDone.current) {
        initialFetchDone.current = true;
        await fetchClusters();
      }

      setIsReady(true);
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
    return <Dashboard />;
  }

  return <HomePage isTauri={isTauri} isReady={isReady} />;
}
