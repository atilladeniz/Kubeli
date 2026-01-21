"use client";

import { useCallback, useEffect, useRef } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch, exit } from "@tauri-apps/plugin-process";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUpdaterStore, isDev } from "@/lib/stores/updater-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { Progress } from "@/components/ui/progress";

// Debug logger - only logs in development
const debug = (...args: unknown[]) => {
  if (isDev) console.log("[Updater]", ...args);
};

// Module-level flag to prevent multiple auto-install triggers across all hook instances
// This is checked synchronously before any async work
let autoInstallInProgress = false;

interface UseUpdaterOptions {
  autoCheck?: boolean;
  autoInstall?: boolean;
  checkInterval?: number; // in milliseconds, 0 = no interval
}

export function useUpdater(options: UseUpdaterOptions = {}) {
  const {
    autoCheck = true,
    autoInstall = false,
    checkInterval = 0,
  } = options;

  const t = useTranslations("updates");

  const {
    checking,
    available,
    downloading,
    progress,
    error,
    update,
    isSimulated,
    readyToRestart,
    downloadComplete,
    checkerDismissed,
    setChecking,
    setAvailable,
    setDownloading,
    setProgress,
    setError,
    setReadyToRestart,
    setDownloadComplete,
    setCheckerDismissed,
    simulateUpdate,
    clearSimulation,
  } = useUpdaterStore();

  const hasCheckedRef = useRef(false);
  const isTauriReady = useCallback(() => {
    if (typeof window === "undefined") return false;
    return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
  }, []);

  const checkForUpdates = useCallback(async (showToast: boolean = false) => {
    if (checking) return null;

    setChecking(true);

    // Show loading toast if requested
    if (showToast) {
      toast.loading(t("checkingForUpdates"), {
        id: "update-check-toast",
        duration: Infinity,
      });
    }

    try {
      const update = await check();
      if (update) {
        debug(` Update available: ${update.version}`);
        setAvailable(true, update);
        if (showToast) {
          toast.dismiss("update-check-toast");
        }
        return update;
      } else {
        debug(" No update available");
        setAvailable(false, null);
        if (showToast) {
          toast.success(t("upToDate"), {
            id: "update-check-toast",
            duration: 2000,
          });
        }
        return null;
      }
    } catch (error) {
      console.error("[Updater] Check failed:", error);
      setError(error instanceof Error ? error.message : "Failed to check for updates");
      if (showToast) {
        toast.error(t("checkFailed"), {
          id: "update-check-toast",
          duration: 3000,
        });
      }
      return null;
    }
  }, [checking, setChecking, setAvailable, setError, t]);

  const downloadAndInstall = useCallback(async (_autoRestart: boolean = false, isAutoInstall: boolean = false) => {
    // Get current state directly from store to avoid stale closure
    const store = useUpdaterStore.getState();

    // Prevent multiple simultaneous downloads
    if (store.downloading) {
      debug(" Already downloading, skipping");
      return;
    }

    // Handle simulated update in dev mode
    if (store.isSimulated && isDev) {
      debug(" DEV: Simulating download...");
      setDownloading(true);
      setProgress(0);

      // Simulate download progress
      const totalSteps = 20;
      for (let i = 1; i <= totalSteps; i++) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        const progressPercent = (i / totalSteps) * 100;
        setProgress(progressPercent);

        // Update toast if auto-install mode
        if (isAutoInstall) {
          toast.loading("Installing update...", {
            id: "auto-install-toast",
            description: (
              <div className="flex flex-col gap-2 w-full">
                <span className="text-xs">Downloading Kubeli v{store.update?.version || "unknown"} - {Math.round(progressPercent)}%</span>
                <Progress value={progressPercent} className="h-1" />
              </div>
            ),
          });
        }
      }

      setDownloading(false);
      setDownloadComplete(true);
      debug(" DEV: Simulated install complete");

      // Update toast to success if auto-install mode
      if (isAutoInstall) {
        toast.success("Update ready!", {
          id: "auto-install-toast",
          description: "Restart to apply the update.",
          duration: 5000,
        });
      }

      // Show restart dialog
      setReadyToRestart(true);
      return;
    }

    // Real update
    if (!update) {
      console.error("[Updater] No update available to install");
      return;
    }

    debug(" Starting download and install...");
    setDownloading(true);
    setProgress(0);

    try {
      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            debug(` Download started: ${contentLength} bytes`);
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            const prog = contentLength > 0 ? (downloaded / contentLength) * 100 : 0;
            debug(` Progress: ${Math.round(prog)}%`);
            setProgress(prog);
            break;
          case "Finished":
            debug(" Download finished, installing...");
            setProgress(100);
            break;
        }
      });

      debug(" Update installed successfully!");
      setDownloading(false);
      setDownloadComplete(true);

      // Show restart dialog instead of auto-relaunch
      setReadyToRestart(true);
    } catch (error) {
      console.error("[Updater] Install failed:", error);
      setError(error instanceof Error ? error.message : "Failed to install update");
      setDownloading(false);
    }
  }, [update, setDownloading, setProgress, setError, setReadyToRestart, setDownloadComplete]);

  // Restart the app now
  const restartNow = useCallback(async () => {
    // Get current isSimulated state directly from store
    const currentIsSimulated = useUpdaterStore.getState().isSimulated;

    if (currentIsSimulated && isDev) {
      debug(" DEV: Simulated restart - clearing state");
      clearSimulation();
      setReadyToRestart(false);
      return;
    }

    debug(" Relaunching app...");
    try {
      await relaunch();
    } catch (err) {
      console.error("[Updater] Relaunch failed, trying exit:", err);
      await exit(0);
    }
  }, [clearSimulation, setReadyToRestart]);

  // Dismiss restart dialog (restart later)
  const restartLater = useCallback(() => {
    debug(" User chose to restart later");
    setReadyToRestart(false);
  }, [setReadyToRestart]);

  // Dismiss UpdateChecker dialog (but keep update available for header button)
  const dismissUpdate = useCallback(() => {
    setCheckerDismissed(true);
  }, [setCheckerDismissed]);

  // Get autoInstallUpdates setting from UI store
  const autoInstallUpdates = useUIStore((state) => state.settings.autoInstallUpdates);

  // DEV: Auto-trigger download when simulated update is detected and autoInstallUpdates is enabled
  useEffect(() => {
    // Read current state directly from store
    const store = useUpdaterStore.getState();

    // Skip if not in dev mode, no simulated update, or already processing
    if (!isDev || !store.isSimulated || !store.available || store.downloading || store.readyToRestart) {
      return;
    }

    if (!autoInstallUpdates) {
      return;
    }

    // Use module-level flag for synchronous check (prevents race condition across hook instances)
    if (autoInstallInProgress) {
      return;
    }

    // Set flag synchronously BEFORE any async work
    autoInstallInProgress = true;

    debug(" DEV: Auto-install enabled, triggering simulated download...");

    // Show initial toast with loading state
    toast.loading("Installing update...", {
      id: "auto-install-toast",
      description: (
        <div className="flex flex-col gap-2 w-full">
          <span className="text-xs">Downloading Kubeli v{store.update?.version || "unknown"} - 0%</span>
          <Progress value={0} className="h-1" />
        </div>
      ),
    });

    downloadAndInstall(false, true); // Pass flag to indicate auto-install (for toast updates)
  }, [isSimulated, available, downloading, readyToRestart, autoInstallUpdates, downloadAndInstall]);

  // Reset module-level flag when simulation is cleared
  useEffect(() => {
    if (!isSimulated) {
      autoInstallInProgress = false;
    }
  }, [isSimulated]);

  // Auto-check on mount
  useEffect(() => {
    if (!autoCheck || hasCheckedRef.current) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const autoCheckFn = async () => {
      if (cancelled) return;

      hasCheckedRef.current = true;

      debug(" Will check for updates in 3 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      if (cancelled) return;

      debug(" Checking for updates...");
      const foundUpdate = await checkForUpdates(true);

      const shouldAutoInstall = autoInstall || autoInstallUpdates;

      if (foundUpdate && shouldAutoInstall) {
        debug(" Auto-installing update...");
        toast.info("Installing update...", {
          description: `Downloading Kubeli v${foundUpdate.version}`,
          duration: 5000,
        });
        await downloadAndInstall();
      }
    };

    const waitForTauriAndCheck = () => {
      if (isTauriReady()) {
        autoCheckFn();
      } else if (!cancelled) {
        retryTimer = setTimeout(waitForTauriAndCheck, 1000);
      }
    };

    waitForTauriAndCheck();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [autoCheck, autoInstall, autoInstallUpdates, checkForUpdates, downloadAndInstall, isTauriReady]);

  // Interval checking
  useEffect(() => {
    if (checkInterval <= 0) return;

    const intervalId = setInterval(() => {
      if (isTauriReady()) {
        checkForUpdates();
      }
    }, checkInterval);

    return () => clearInterval(intervalId);
  }, [checkInterval, checkForUpdates, isTauriReady]);

  return {
    checking,
    available,
    downloading,
    progress,
    error,
    update,
    readyToRestart,
    downloadComplete,
    checkerDismissed,
    checkForUpdates,
    downloadAndInstall,
    restartNow,
    restartLater,
    dismissUpdate,
    // DEV ONLY exports
    isDev,
    isSimulated,
    simulateUpdate,
    clearSimulation,
  };
}
