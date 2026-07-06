"use client";

import { useEffect } from "react";
import { usePortForwardStore } from "@/lib/stores/portforward-store";

export function usePortForward() {
  const forwards = usePortForwardStore((s) => s.forwards);
  const isLoading = usePortForwardStore((s) => s.isLoading);
  const error = usePortForwardStore((s) => s.error);
  const initialize = usePortForwardStore((s) => s.initialize);
  const startForward = usePortForwardStore((s) => s.startForward);
  const stopForward = usePortForwardStore((s) => s.stopForward);
  const stopAllForwards = usePortForwardStore((s) => s.stopAllForwards);
  const checkPort = usePortForwardStore((s) => s.checkPort);
  const getForward = usePortForwardStore((s) => s.getForward);
  const refreshForwards = usePortForwardStore((s) => s.refreshForwards);
  const requestForward = usePortForwardStore((s) => s.requestForward);
  const dismissForwardDialog = usePortForwardStore((s) => s.dismissForwardDialog);

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
    requestForward,
    dismissForwardDialog,
  };
}
