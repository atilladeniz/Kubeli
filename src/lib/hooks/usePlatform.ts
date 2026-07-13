"use client";

import { useState, useEffect } from "react";

export type Platform = "macos" | "windows" | "linux" | "unknown";

// Platform never changes at runtime - detect once at module level and let
// every hook mount read the cached value instead of re-running detection.
let cachedPlatform: Platform | null = null;
let detectionPromise: Promise<Platform> | null = null;

async function detectPlatform(): Promise<Platform> {
  try {
    const { type } = await import("@tauri-apps/plugin-os");
    const osType = await type();
    if (osType === "macos") return "macos";
    if (osType === "windows") return "windows";
    if (osType === "linux") return "linux";
  } catch {
    // Fallback to navigator if Tauri not available
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes("mac")) return "macos";
      if (ua.includes("win")) return "windows";
      if (ua.includes("linux")) return "linux";
    }
  }
  return "unknown";
}

export function usePlatform() {
  const [platform, setPlatform] = useState<Platform>(cachedPlatform ?? "unknown");

  useEffect(() => {
    if (cachedPlatform !== null) return;
    detectionPromise ??= detectPlatform().then((detected) => {
      cachedPlatform = detected;
      return detected;
    });
    let cancelled = false;
    detectionPromise.then((detected) => {
      if (!cancelled) setPlatform(detected);
    });
    return () => {
      cancelled = true;
    };
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
