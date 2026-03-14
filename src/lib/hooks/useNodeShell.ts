"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  nodeShellStart,
  nodeShellCleanup,
  shellSendInput,
  shellResize,
  shellClose,
} from "../tauri/commands";
import type { ShellEvent, NodeShellOptions } from "../types";

export interface UseNodeShellOptions {
  onOutput?: (data: string) => void;
  onError?: (error: string) => void;
  onStarted?: () => void;
  onClosed?: () => void;
}

export interface UseNodeShellReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendInput: (input: string) => Promise<void>;
  resize: (cols: number, rows: number) => Promise<void>;
}

export function useNodeShell(
  nodeName: string,
  options: UseNodeShellOptions = {},
  sessionIdOverride?: string
): UseNodeShellReturn {
  const { onOutput, onError, onStarted, onClosed } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(sessionIdOverride || null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const mountedRef = useRef(true);

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
        nodeShellCleanup(sessionIdRef.current).catch(console.error);
      }
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);

  const connect = useCallback(async () => {
    if (!nodeName || isConnected || isConnecting) return;

    // Disconnect any existing session first
    if (sessionIdRef.current) {
      await nodeShellCleanup(sessionIdRef.current).catch(console.error);
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    }

    const sessionId = sessionIdOverride || `node-shell-${nodeName}-${Date.now()}`;
    sessionIdRef.current = sessionId;

    setError(null);
    setIsConnecting(true);

    try {
      const eventName = `shell-${sessionId}`;
      unlistenRef.current = await listen<ShellEvent>(eventName, (event) => {
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

      const nodeShellOptions: NodeShellOptions = {
        node_name: nodeName,
      };

      await nodeShellStart(sessionId, nodeShellOptions);
    } catch (e) {
      if (!mountedRef.current) return;
      const errorMsg = e instanceof Error ? e.message : "Failed to start node shell";
      setError(errorMsg);
      setIsConnecting(false);
      setIsConnected(false);
      sessionIdRef.current = null;
      onError?.(errorMsg);
    }
  }, [nodeName, isConnected, isConnecting, sessionIdOverride, onOutput, onError, onStarted, onClosed]);

  const disconnect = useCallback(async () => {
    if (!sessionIdRef.current) return;

    try {
      await nodeShellCleanup(sessionIdRef.current);
    } catch (e) {
      // Fallback to regular shell close
      try {
        await shellClose(sessionIdRef.current!);
      } catch {
        console.error("Failed to close node shell:", e);
      }
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
    connect,
    disconnect,
    sendInput,
    resize,
  };
}
