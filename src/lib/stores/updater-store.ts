import { create } from "zustand";
import type { Update } from "@tauri-apps/plugin-updater";

// Check if we're in development mode
export const isDev = process.env.NODE_ENV === "development";

// Debug logger - only logs in development
const debug = (...args: unknown[]) => {
  if (isDev) console.log("[Updater]", ...args);
};

export interface UpdaterState {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
  update: Update | null;
  isSimulated: boolean;

  // Ready to restart (download complete, waiting for user)
  readyToRestart: boolean;

  // Download has completed (persists even after dismissing restart dialog)
  downloadComplete: boolean;

  // UpdateChecker dialog dismissed (but update still available)
  checkerDismissed: boolean;

  // Actions
  setChecking: (checking: boolean) => void;
  setAvailable: (available: boolean, update: Update | null) => void;
  setDownloading: (downloading: boolean) => void;
  setProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  setReadyToRestart: (ready: boolean) => void;
  setDownloadComplete: (complete: boolean) => void;
  setCheckerDismissed: (dismissed: boolean) => void;
  reset: () => void;

  // DEV: Simulation
  simulateUpdate: (version: string) => void;
  clearSimulation: () => void;
}

export const useUpdaterStore = create<UpdaterState>((set) => ({
  checking: false,
  available: false,
  downloading: false,
  progress: 0,
  error: null,
  update: null,
  isSimulated: false,
  readyToRestart: false,
  downloadComplete: false,
  checkerDismissed: false,

  setChecking: (checking) => set({ checking, error: null }),

  setAvailable: (available, update) => set({ available, update, checking: false, checkerDismissed: false }),

  setDownloading: (downloading) => set({ downloading }),

  setProgress: (progress) => set({ progress }),

  setError: (error) => set({ error, checking: false, downloading: false }),

  setReadyToRestart: (ready) => set({ readyToRestart: ready }),

  setDownloadComplete: (complete) => set({ downloadComplete: complete }),

  setCheckerDismissed: (dismissed) => set({ checkerDismissed: dismissed }),

  reset: () => set({
    checking: false,
    available: false,
    downloading: false,
    progress: 0,
    error: null,
    update: null,
    isSimulated: false,
    readyToRestart: false,
    downloadComplete: false,
    checkerDismissed: false,
  }),

  // DEV ONLY: Simulate an available update
  simulateUpdate: (version: string) => {
    if (!isDev) return;
    debug(`DEV: Simulating update to v${version}`);

    const mockUpdate = {
      version,
      currentVersion: "0.1.0",
      date: new Date().toISOString(),
      body: "This is a simulated update for testing purposes.",
    } as unknown as Update;

    set({
      available: true,
      update: mockUpdate,
      isSimulated: true,
    });
  },

  clearSimulation: () => {
    if (!isDev) return;
    debug("DEV: Clearing simulated update");
    set({
      available: false,
      update: null,
      downloading: false,
      progress: 0,
      isSimulated: false,
      readyToRestart: false,
      downloadComplete: false,
      checkerDismissed: false,
    });
  },
}));
