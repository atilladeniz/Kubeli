"use client";

import { useEffect } from "react";
import { usePortForwardStore } from "@/lib/stores/portforward-store";

export interface UsePortForwardOptions {
  onStarted?: (forwardId: string, localPort: number) => void;
  onConnected?: (forwardId: string) => void;
  onDisconnected?: (forwardId: string) => void;
  onError?: (forwardId: string, message: string) => void;
  onStopped?: (forwardId: string) => void;
}

 
export function usePortForward(_options?: UsePortForwardOptions) {
  const {
    forwards,
    isLoading,
    error,
    initialize,
    startForward,
    stopForward,
    stopAllForwards,
    checkPort,
    getForward,
    refreshForwards,
  } = usePortForwardStore();

  // Initialize only once across all hook instances
  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    forwards,
    isLoading,
    error,
    startForward,
    stopForward,
    stopAllForwards,
    checkPort,
    getForward,
    refreshForwards,
  };
}
