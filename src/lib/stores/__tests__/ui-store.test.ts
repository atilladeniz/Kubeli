import { act } from "@testing-library/react";
import { useUIStore, defaultSettings, type Theme, type AppSettings } from "../ui-store";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("UIStore", () => {
  beforeEach(() => {
    // Clear localStorage and reset store
    localStorageMock.clear();
    useUIStore.setState({
      settings: { ...defaultSettings },
      resolvedTheme: "classic-dark",
      isSettingsOpen: false,
      isAIAssistantOpen: false,
      pendingPodLogs: null,
    });
  });

  describe("initial state", () => {
    it("should have default settings", () => {
      const state = useUIStore.getState();
      expect(state.settings).toEqual(defaultSettings);
    });

    it("should have classic-dark as default theme", () => {
      const state = useUIStore.getState();
      expect(state.settings.theme).toBe("classic-dark");
      expect(state.resolvedTheme).toBe("classic-dark");
    });

    it("should have settings panel closed by default", () => {
      expect(useUIStore.getState().isSettingsOpen).toBe(false);
    });

    it("should have AI assistant closed by default", () => {
      expect(useUIStore.getState().isAIAssistantOpen).toBe(false);
    });
  });

  describe("setTheme", () => {
    it("should set light theme", () => {
      act(() => {
        useUIStore.getState().setTheme("light");
      });

      const state = useUIStore.getState();
      expect(state.settings.theme).toBe("light");
      expect(state.resolvedTheme).toBe("light");
    });

    it("should set dark theme", () => {
      act(() => {
        useUIStore.getState().setTheme("dark");
      });

      const state = useUIStore.getState();
      expect(state.settings.theme).toBe("dark");
      expect(state.resolvedTheme).toBe("dark");
    });

    it("should set classic-dark theme", () => {
      act(() => {
        useUIStore.getState().setTheme("classic-dark");
      });

      const state = useUIStore.getState();
      expect(state.settings.theme).toBe("classic-dark");
      expect(state.resolvedTheme).toBe("classic-dark");
    });

    it("should resolve system theme based on media query", () => {
      // matchMedia is mocked in jest.setup.ts to return matches: false (light mode)
      act(() => {
        useUIStore.getState().setTheme("system");
      });

      const state = useUIStore.getState();
      expect(state.settings.theme).toBe("system");
      expect(state.resolvedTheme).toBe("light"); // Based on mocked matchMedia
    });
  });

  describe("setLocale", () => {
    it("should set locale to German", () => {
      act(() => {
        useUIStore.getState().setLocale("de");
      });

      expect(useUIStore.getState().settings.locale).toBe("de");
    });

    it("should set locale to English", () => {
      useUIStore.setState({
        settings: { ...defaultSettings, locale: "de" },
      });

      act(() => {
        useUIStore.getState().setLocale("en");
      });

      expect(useUIStore.getState().settings.locale).toBe("en");
    });
  });

  describe("updateSettings", () => {
    it("should update single setting", () => {
      act(() => {
        useUIStore.getState().updateSettings({ refreshInterval: 60 });
      });

      expect(useUIStore.getState().settings.refreshInterval).toBe(60);
    });

    it("should update multiple settings at once", () => {
      act(() => {
        useUIStore.getState().updateSettings({
          refreshInterval: 120,
          logRetentionLines: 10000,
          editorFontSize: 16,
        });
      });

      const settings = useUIStore.getState().settings;
      expect(settings.refreshInterval).toBe(120);
      expect(settings.logRetentionLines).toBe(10000);
      expect(settings.editorFontSize).toBe(16);
    });

    it("should preserve other settings when updating", () => {
      const originalTheme = useUIStore.getState().settings.theme;

      act(() => {
        useUIStore.getState().updateSettings({ refreshInterval: 90 });
      });

      expect(useUIStore.getState().settings.theme).toBe(originalTheme);
    });
  });

  describe("resetSettings", () => {
    it("should reset all settings to defaults", () => {
      // Change some settings
      act(() => {
        useUIStore.getState().updateSettings({
          theme: "light",
          refreshInterval: 120,
          editorFontSize: 20,
        });
      });

      // Reset
      act(() => {
        useUIStore.getState().resetSettings();
      });

      expect(useUIStore.getState().settings).toEqual(defaultSettings);
    });

    it("should reset resolved theme", () => {
      act(() => {
        useUIStore.getState().setTheme("light");
      });

      act(() => {
        useUIStore.getState().resetSettings();
      });

      expect(useUIStore.getState().resolvedTheme).toBe("classic-dark");
    });
  });

  describe("setSettingsOpen", () => {
    it("should open settings panel", () => {
      act(() => {
        useUIStore.getState().setSettingsOpen(true);
      });

      expect(useUIStore.getState().isSettingsOpen).toBe(true);
    });

    it("should close settings panel", () => {
      useUIStore.setState({ isSettingsOpen: true });

      act(() => {
        useUIStore.getState().setSettingsOpen(false);
      });

      expect(useUIStore.getState().isSettingsOpen).toBe(false);
    });
  });

  describe("AI Assistant", () => {
    it("should open AI assistant", () => {
      act(() => {
        useUIStore.getState().setAIAssistantOpen(true);
      });

      expect(useUIStore.getState().isAIAssistantOpen).toBe(true);
    });

    it("should close AI assistant", () => {
      useUIStore.setState({ isAIAssistantOpen: true });

      act(() => {
        useUIStore.getState().setAIAssistantOpen(false);
      });

      expect(useUIStore.getState().isAIAssistantOpen).toBe(false);
    });

    it("should toggle AI assistant", () => {
      expect(useUIStore.getState().isAIAssistantOpen).toBe(false);

      act(() => {
        useUIStore.getState().toggleAIAssistant();
      });
      expect(useUIStore.getState().isAIAssistantOpen).toBe(true);

      act(() => {
        useUIStore.getState().toggleAIAssistant();
      });
      expect(useUIStore.getState().isAIAssistantOpen).toBe(false);
    });
  });

  describe("pendingPodLogs", () => {
    it("should set pending pod logs", () => {
      act(() => {
        useUIStore.getState().setPendingPodLogs({
          namespace: "default",
          podName: "nginx-pod",
        });
      });

      expect(useUIStore.getState().pendingPodLogs).toEqual({
        namespace: "default",
        podName: "nginx-pod",
      });
    });

    it("should clear pending pod logs", () => {
      useUIStore.setState({
        pendingPodLogs: { namespace: "default", podName: "nginx-pod" },
      });

      act(() => {
        useUIStore.getState().setPendingPodLogs(null);
      });

      expect(useUIStore.getState().pendingPodLogs).toBeNull();
    });
  });

  describe("setResolvedTheme", () => {
    it("should set resolved theme directly", () => {
      act(() => {
        useUIStore.getState().setResolvedTheme("dark");
      });

      expect(useUIStore.getState().resolvedTheme).toBe("dark");
    });
  });

  describe("default settings values", () => {
    it("should have correct default values", () => {
      expect(defaultSettings.theme).toBe("classic-dark");
      expect(defaultSettings.vibrancyLevel).toBe("standard");
      expect(defaultSettings.refreshInterval).toBe(30);
      expect(defaultSettings.portForwardOpenBrowser).toBe("ask");
      expect(defaultSettings.autoInstallUpdates).toBe(false);
      expect(defaultSettings.logRetentionLines).toBe(5000);
      expect(defaultSettings.logShowTimestamps).toBe(true);
      expect(defaultSettings.editorFontSize).toBe(13);
      expect(defaultSettings.editorWordWrap).toBe(false);
      expect(defaultSettings.enableAnimations).toBe(true);
      expect(defaultSettings.virtualScrollThreshold).toBe(100);
      expect(defaultSettings.proxyType).toBe("none");
      expect(defaultSettings.aiCliProvider).toBe("claude");
    });
  });
});
