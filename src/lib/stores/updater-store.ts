import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Update } from "@tauri-apps/plugin-updater";

/** How long "Later" hides the update popup for the same version. */
export const UPDATE_SNOOZE_MS = 24 * 60 * 60 * 1000;

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

  // "Later" snooze, persisted: the popup stays hidden for this version until the deadline
  snoozedVersion: string | null;
  snoozedUntil: number | null;

  // Auto-check has been performed (prevents multiple checks on remount)
  hasAutoChecked: boolean;

  // Actions
  setChecking: (checking: boolean) => void;
  setAvailable: (available: boolean, update: Update | null) => void;
  setDownloading: (downloading: boolean) => void;
  setProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  setReadyToRestart: (ready: boolean) => void;
  setDownloadComplete: (complete: boolean) => void;
  setCheckerDismissed: (dismissed: boolean) => void;
  snoozeUpdate: () => void;
  setHasAutoChecked: (checked: boolean) => void;
  reset: () => void;

  // DEV: Simulation
  simulateUpdate: (version: string) => void;
  clearSimulation: () => void;
}

function isSnoozed(
  state: Pick<UpdaterState, "snoozedVersion" | "snoozedUntil">,
  version: string | undefined,
) {
  return (
    !!version &&
    state.snoozedVersion === version &&
    state.snoozedUntil !== null &&
    state.snoozedUntil > Date.now()
  );
}

export const useUpdaterStore = create<UpdaterState>()(
  persist(
    (set) => ({
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
      snoozedVersion: null,
      snoozedUntil: null,
      hasAutoChecked: false,

      setChecking: (checking) => set({ checking, error: null }),

      // A re-check must not undo "Later": keep the popup hidden while the snooze
      // for this exact version is active, show it again for a newer version.
      setAvailable: (available, update) =>
        set((state) => ({
          available,
          update,
          checking: false,
          checkerDismissed: isSnoozed(state, update?.version),
        })),

      snoozeUpdate: () =>
        set((state) => ({
          checkerDismissed: true,
          snoozedVersion: state.update?.version ?? null,
          snoozedUntil: Date.now() + UPDATE_SNOOZE_MS,
        })),

      setDownloading: (downloading) => set({ downloading }),

      // Quantize to whole percent: download events fire per chunk; sub-percent
      // writes would re-render every subscriber hundreds of times per download.
      setProgress: (progress) =>
        set((state) => {
          const rounded = Math.round(progress);
          return rounded === state.progress ? state : { progress: rounded };
        }),

      setError: (error) => set({ error, checking: false, downloading: false }),

      setReadyToRestart: (ready) => set({ readyToRestart: ready }),

      setDownloadComplete: (complete) => set({ downloadComplete: complete }),

      setCheckerDismissed: (dismissed) => set({ checkerDismissed: dismissed }),

      setHasAutoChecked: (checked) => set({ hasAutoChecked: checked }),

      reset: () =>
        set({
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
          snoozedVersion: null,
          snoozedUntil: null,
          hasAutoChecked: false,
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
    }),
    {
      name: "kubeli-updater",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        snoozedVersion: state.snoozedVersion,
        snoozedUntil: state.snoozedUntil,
      }),
    },
  ),
);
