import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Locale } from "@/i18n/config";
import { defaultLocale, isValidLocale } from "@/i18n/config";

export type Theme = "light" | "dark" | "classic-dark" | "system";

export type VibrancyLevel = "off" | "standard" | "more" | "extra";

export type PortForwardBrowserBehavior = "ask" | "always" | "never";

export type ProxyType = "none" | "system" | "http" | "socks5";

export type AiCliProvider = "claude" | "codex";

export interface AppSettings {
  // Appearance
  theme: Theme;
  vibrancyLevel: VibrancyLevel; // Window blur/transparency level (macOS)
  locale: Locale; // UI language (en, de)

  // General
  defaultNamespace: string;
  refreshInterval: number; // in seconds

  // Port Forward
  portForwardOpenBrowser: PortForwardBrowserBehavior;

  // Updates
  autoInstallUpdates: boolean;

  // Logs
  logRetentionLines: number;
  logShowTimestamps: boolean;

  // Editor
  editorFontSize: number;
  editorWordWrap: boolean;

  // Performance
  enableAnimations: boolean;
  virtualScrollThreshold: number;

  // Network/Proxy
  proxyType: ProxyType;
  proxyHost: string;
  proxyPort: number;
  proxyUsername: string;
  proxyPassword: string;

  // AI Assistant
  aiCliProvider: AiCliProvider;
}

export const defaultSettings: AppSettings = {
  theme: "classic-dark",
  vibrancyLevel: "standard",
  locale: defaultLocale,
  defaultNamespace: "",
  refreshInterval: 30,
  portForwardOpenBrowser: "ask",
  autoInstallUpdates: false,
  logRetentionLines: 5000,
  logShowTimestamps: true,
  editorFontSize: 13,
  editorWordWrap: false,
  enableAnimations: true,
  virtualScrollThreshold: 100,
  proxyType: "none",
  proxyHost: "",
  proxyPort: 8080,
  proxyUsername: "",
  proxyPassword: "",
  aiCliProvider: "claude",
};

interface UIState {
  // Settings
  settings: AppSettings;

  // Computed theme (resolves "system" to actual theme)
  resolvedTheme: "light" | "dark" | "classic-dark";

  // Settings panel state
  isSettingsOpen: boolean;

  // AI panel state
  isAIAssistantOpen: boolean;

  // Navigation state - for navigating to specific resources
  pendingPodLogs: { namespace: string; podName: string } | null;

  // Actions
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  setSettingsOpen: (open: boolean) => void;
  setResolvedTheme: (theme: "light" | "dark" | "classic-dark") => void;
  setAIAssistantOpen: (open: boolean) => void;
  toggleAIAssistant: () => void;
  setPendingPodLogs: (
    pod: { namespace: string; podName: string } | null
  ) => void;
}

// Helper to get valid vibrancy level
const getValidVibrancyLevel = (value: unknown): VibrancyLevel => {
  const validLevels: VibrancyLevel[] = ["off", "standard", "more", "extra"];
  if (typeof value === "string" && validLevels.includes(value as VibrancyLevel)) {
    return value as VibrancyLevel;
  }
  return defaultSettings.vibrancyLevel;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      resolvedTheme: "classic-dark",
      isSettingsOpen: false,
      isAIAssistantOpen: false,
      pendingPodLogs: null,

      setTheme: (theme) => {
        set((state) => ({
          settings: { ...state.settings, theme },
        }));

        // Update resolved theme
        if (theme === "system") {
          const isDark =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches;
          set({ resolvedTheme: isDark ? "dark" : "light" });
        } else if (theme === "classic-dark") {
          set({ resolvedTheme: "classic-dark" });
        } else {
          set({ resolvedTheme: theme as "light" | "dark" });
        }
      },

      setLocale: (locale) =>
        set((state) => ({
          settings: { ...state.settings, locale },
        })),

      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      resetSettings: () => {
        let resolvedTheme: "light" | "dark" | "classic-dark";
        if (defaultSettings.theme === "system") {
          resolvedTheme =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
              ? "dark"
              : "light";
        } else if (defaultSettings.theme === "classic-dark") {
          resolvedTheme = "classic-dark";
        } else {
          resolvedTheme = defaultSettings.theme as "light" | "dark";
        }
        set({ settings: defaultSettings, resolvedTheme });
      },

      setSettingsOpen: (open) => set({ isSettingsOpen: open }),

      setResolvedTheme: (theme) => set({ resolvedTheme: theme }),

      setAIAssistantOpen: (open) => set({ isAIAssistantOpen: open }),

      toggleAIAssistant: () =>
        set((state) => ({ isAIAssistantOpen: !state.isAIAssistantOpen })),

      setPendingPodLogs: (pod) => set({ pendingPodLogs: pod }),
    }),
    {
      name: "kubeli-ui-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }),
      onRehydrateStorage: () => (state) => {
        // Merge persisted settings with defaults to handle new fields
        const persistedSettings = (state?.settings || {}) as Partial<AppSettings>;
        const mergedSettings: AppSettings = {
          ...defaultSettings,
          ...persistedSettings,
          // Always validate vibrancyLevel
          vibrancyLevel: getValidVibrancyLevel(persistedSettings.vibrancyLevel),
          // Validate locale
          locale: isValidLocale(persistedSettings.locale as string)
            ? persistedSettings.locale!
            : defaultSettings.locale,
        };

        // Initialize resolved theme after rehydration
        const theme = mergedSettings.theme;
        let resolvedTheme: "light" | "dark" | "classic-dark";
        if (theme === "system") {
          const isDark =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches;
          resolvedTheme = isDark ? "dark" : "light";
        } else if (theme === "classic-dark") {
          resolvedTheme = "classic-dark";
        } else {
          resolvedTheme = theme as "light" | "dark";
        }
        // Use setState to properly update the store with merged settings
        useUIStore.setState({ settings: mergedSettings, resolvedTheme });
      },
    }
  )
);
