"use client";

import { useSyncExternalStore } from "react";

/**
 * How long the window may stay hidden or unfocused before the app counts as
 * idle. Short enough to matter for a minimised app, long enough that a quick
 * alt-tab to a terminal does not tear down every watch.
 */
export const IDLE_GRACE_MS = 30_000;

let active = true;
let focused = true;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let bound = false;
const listeners = new Set<() => void>();

function setActive(next: boolean) {
  if (active === next) return;
  active = next;
  listeners.forEach((listener) => listener());
}

function evaluate() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  const idle = document.hidden || !focused;
  if (!idle) {
    setActive(true);
    return;
  }
  idleTimer = setTimeout(() => {
    idleTimer = null;
    setActive(false);
  }, IDLE_GRACE_MS);
}

// One set of DOM listeners for the whole app, bound on first subscription.
// Window focus/blur fire inside the Tauri webview when the app loses or
// regains focus; visibilitychange covers minimise and hidden windows.
function bind() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  document.addEventListener("visibilitychange", evaluate);
  window.addEventListener("focus", () => {
    focused = true;
    evaluate();
  });
  window.addEventListener("blur", () => {
    focused = false;
    evaluate();
  });
}

function subscribe(listener: () => void) {
  bind();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => active;
const getServerSnapshot = () => true;

/**
 * True while the window is visible and focused, or was within the last
 * IDLE_GRACE_MS. Pollers and watches pause on false and resume on true.
 */
export function useAppActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
