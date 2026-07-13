"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  shellStart,
  shellSendInput,
  shellResize,
  shellClose,
  getPodContainers,
} from "../tauri/commands";
import type { ShellEvent, ShellOptions } from "../types";

export interface UseShellOptions {
  onOutput?: (data: string) => void;
  onError?: (error: string) => void;
  onStarted?: () => void;
  onClosed?: () => void;
}

export interface UseShellReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  containers: string[];
  selectedContainer: string | null;
  setSelectedContainer: (container: string | null) => void;
  connect: (options?: Partial<Omit<ShellOptions, "namespace" | "pod_name">>) => Promise<void>;
  disconnect: () => Promise<void>;
  sendInput: (input: string) => Promise<void>;
  resize: (cols: number, rows: number) => Promise<void>;
}

export function useShell(
  namespace: string,
  podName: string,
  options: UseShellOptions = {},
  sessionIdOverride?: string
): UseShellReturn {
  const { onOutput, onError, onStarted, onClosed } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [containers, setContainers] = useState<string[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(sessionIdOverride || null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const mountedRef = useRef(true);

  // Fetch containers when namespace/pod changes
  useEffect(() => {
    if (!namespace || !podName) return;

    const fetchContainers = async () => {
      try {
        const containerList = await getPodContainers(namespace, podName);
        // Filter out init containers for shell
        const mainContainers = containerList.filter((c) => !c.startsWith("init:"));
        setContainers(mainContainers);
        // Auto-select the first container only when nothing is selected yet -
        // a refetch must not stomp the user's manual container choice.
        setSelectedContainer((current) => current ?? mainContainers[0] ?? null);
      } catch (e) {
        console.error("Failed to fetch containers:", e);
      }
    };

    fetchContainers();
  }, [namespace, podName]);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        shellClose(sessionIdRef.current).catch(console.error);
      }
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);

  const connect = useCallback(
    async (connectOptions: Partial<Omit<ShellOptions, "namespace" | "pod_name">> = {}) => {
      if (!namespace || !podName || isConnected || isConnecting) return;

      // Disconnect any existing session first
      if (sessionIdRef.current) {
        await shellClose(sessionIdRef.current).catch(console.error);
        if (unlistenRef.current) {
          unlistenRef.current();
          unlistenRef.current = null;
        }
      }

      // Use override or generate new session ID
      const sessionId = sessionIdOverride || `shell-${namespace}-${podName}-${Date.now()}`;
      sessionIdRef.current = sessionId;

      setError(null);
      setIsConnecting(true);

      try {
        // Set up event listener before starting shell
        const eventName = `shell-${sessionId}`;
        unlistenRef.current = await listen<ShellEvent>(eventName, (event) => {
          // Only update state if component is still mounted
          if (!mountedRef.current) return;

          const shellEvent = event.payload;

          switch (shellEvent.type) {
            case "Output":
              onOutput?.(shellEvent.data);
              break;
            case "Error":
              setError(shellEvent.data);
              onError?.(shellEvent.data);
              break;
            case "Started":
              setIsConnected(true);
              setIsConnecting(false);
              onStarted?.();
              break;
            case "Closed":
              setIsConnected(false);
              setIsConnecting(false);
              sessionIdRef.current = null;
              onClosed?.();
              break;
          }
        });

        const shellOptions: ShellOptions = {
          namespace,
          pod_name: podName,
          container: selectedContainer || undefined,
          command: connectOptions.command,
        };

        await shellStart(sessionId, shellOptions);
      } catch (e) {
        if (!mountedRef.current) return;
        const errorMsg = e instanceof Error ? e.message : "Failed to start shell";
        setError(errorMsg);
        setIsConnecting(false);
        setIsConnected(false);
        sessionIdRef.current = null;
        onError?.(errorMsg);
      }
    },
    [namespace, podName, selectedContainer, isConnected, isConnecting, sessionIdOverride, onOutput, onError, onStarted, onClosed]
  );

  const disconnect = useCallback(async () => {
    if (!sessionIdRef.current) return;

    try {
      await shellClose(sessionIdRef.current);
    } catch (e) {
      console.error("Failed to close shell:", e);
    } finally {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      sessionIdRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, []);

  const sendInput = useCallback(async (input: string) => {
    if (!sessionIdRef.current || !isConnected) return;

    try {
      await shellSendInput(sessionIdRef.current, input);
    } catch (e) {
      console.error("Failed to send input:", e);
    }
  }, [isConnected]);

  const resize = useCallback(async (cols: number, rows: number) => {
    if (!sessionIdRef.current || !isConnected) return;

    try {
      await shellResize(sessionIdRef.current, cols, rows);
    } catch (e) {
      console.error("Failed to resize terminal:", e);
    }
  }, [isConnected]);

  return {
    isConnected,
    isConnecting,
    error,
    containers,
    selectedContainer,
    setSelectedContainer,
    connect,
    disconnect,
    sendInput,
    resize,
  };
}
