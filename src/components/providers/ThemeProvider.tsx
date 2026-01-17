"use client";

import { useEffect } from "react";
import { useUIStore } from "@/lib/stores/ui-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings, resolvedTheme, setResolvedTheme, setSettingsOpen, isSettingsOpen } = useUIStore();

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+, or Ctrl+, to open settings
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(!isSettingsOpen);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSettingsOpen, isSettingsOpen]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    // Remove all theme classes first
    root.classList.remove("dark", "light", "classic-dark");

    // Add the appropriate class
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else if (resolvedTheme === "classic-dark") {
      root.classList.add("classic-dark");
    } else {
      root.classList.add("light");
    }
  }, [resolvedTheme]);

  // Apply vibrancy class to document
  useEffect(() => {
    const root = document.documentElement;

    // Remove all vibrancy classes first
    root.classList.remove(
      "vibrancy-off",
      "vibrancy-standard",
      "vibrancy-more",
      "vibrancy-extra"
    );

    // Add the appropriate vibrancy class
    root.classList.add(`vibrancy-${settings.vibrancyLevel}`);
  }, [settings.vibrancyLevel]);

  // Listen for system theme changes
  useEffect(() => {
    if (settings.theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [settings.theme, setResolvedTheme]);

  // Initialize resolved theme on mount
  useEffect(() => {
    if (settings.theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setResolvedTheme(isDark ? "dark" : "light");
    } else if (settings.theme === "classic-dark") {
      setResolvedTheme("classic-dark");
    } else {
      setResolvedTheme(settings.theme as "light" | "dark");
    }
  }, [settings.theme, setResolvedTheme]);

  return <>{children}</>;
}
