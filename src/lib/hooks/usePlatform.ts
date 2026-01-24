"use client";

import { useState, useEffect } from "react";

export type Platform = "macos" | "windows" | "linux" | "unknown";

export function usePlatform() {
  const [platform, setPlatform] = useState<Platform>("unknown");

  useEffect(() => {
    const detectPlatform = async () => {
      try {
        const { type } = await import("@tauri-apps/plugin-os");
        const osType = await type();
        if (osType === "macos") {
          setPlatform("macos");
        } else if (osType === "windows") {
          setPlatform("windows");
        } else if (osType === "linux") {
          setPlatform("linux");
        }
      } catch {
        // Fallback to navigator if Tauri not available
        if (typeof navigator !== "undefined") {
          const ua = navigator.userAgent.toLowerCase();
          if (ua.includes("mac")) {
            setPlatform("macos");
          } else if (ua.includes("win")) {
            setPlatform("windows");
          } else if (ua.includes("linux")) {
            setPlatform("linux");
          }
        }
      }
    };
    detectPlatform();
  }, []);

  const isMac = platform === "macos";
  const isWindows = platform === "windows";
  const isLinux = platform === "linux";

  // Modifier key symbol: ⌘ for Mac, Ctrl for Windows/Linux
  const modKey = isMac ? "⌘" : "Ctrl";
  const modKeySymbol = isMac ? "⌘" : "Ctrl+";

  // Alt key: ⌥ for Mac, Alt for Windows/Linux
  const altKey = isMac ? "⌥" : "Alt";
  const altKeySymbol = isMac ? "⌥" : "Alt+";

  // Shift key symbol
  const shiftKey = isMac ? "⇧" : "Shift";
  const shiftKeySymbol = isMac ? "⇧" : "Shift+";

  return {
    platform,
    isMac,
    isWindows,
    isLinux,
    modKey,
    modKeySymbol,
    altKey,
    altKeySymbol,
    shiftKey,
    shiftKeySymbol,
  };
}
