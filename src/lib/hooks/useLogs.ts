"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  getPodLogs,
  streamPodLogs,
  stopLogStream,
  getPodContainers,
  downloadPodLogs,
} from "../tauri/commands";
import type { LogEntry, LogOptions, LogEvent } from "../types";

export interface UseLogsOptions {
  maxLines?: number;
  autoScroll?: boolean;
}

export interface UseLogsReturn {
  logs: LogEntry[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  containers: string[];
  selectedContainer: string | null;
  setSelectedContainer: (container: string | null) => void;
  fetchLogs: (options: Omit<LogOptions, "namespace" | "pod_name">) => Promise<void>;
  startStream: (options?: Omit<LogOptions, "namespace" | "pod_name">) => Promise<void>;
  stopStream: () => Promise<void>;
  clearLogs: () => void;
  downloadLogs: () => Promise<string>;
  searchLogs: (query: string) => LogEntry[];
}

export function useLogs(
  namespace: string,
  podName: string,
  options: UseLogsOptions = {}
): UseLogsReturn {
  const { maxLines = 10000 } = options;
  const flushIntervalMs = 150;

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [containers, setContainers] = useState<string[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);

  const streamIdRef = useRef<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const logsRef = useRef<LogEntry[]>([]);
  const pendingLogsRef = useRef<LogEntry[]>([]);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch containers when namespace/pod changes
  useEffect(() => {
    if (!namespace || !podName) return;

    const fetchContainers = async () => {
      try {
        const containerList = await getPodContainers(namespace, podName);
        setContainers(containerList);
        // Auto-select first container if none selected
        if (containerList.length > 0 && !selectedContainer) {
          setSelectedContainer(containerList[0]);
        }
      } catch (e) {
        console.error("Failed to fetch containers:", e);
      }
    };

    fetchContainers();
  }, [namespace, podName, selectedContainer]);

  const flushPendingLogs = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    if (pendingLogsRef.current.length === 0) return;

    const pending = pendingLogsRef.current;
    pendingLogsRef.current = [];

    const nextLogs = logsRef.current;
    nextLogs.push(...pending);
    if (nextLogs.length > maxLines) {
      nextLogs.splice(0, nextLogs.length - maxLines);
    }
    logsRef.current = nextLogs;
    setLogs([...nextLogs]);
  }, [maxLines]);

  const scheduleFlush = useCallback(() => {
    if (flushTimeoutRef.current) return;
    flushTimeoutRef.current = setTimeout(() => {
      flushPendingLogs();
    }, flushIntervalMs);
  }, [flushIntervalMs, flushPendingLogs]);

  const enqueueLog = useCallback(
    (entry: LogEntry) => {
      pendingLogsRef.current.push(entry);
      scheduleFlush();
    },
    [scheduleFlush]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      flushPendingLogs();
      if (streamIdRef.current) {
        stopLogStream(streamIdRef.current).catch(console.error);
      }
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, [flushPendingLogs]);

  const fetchLogs = useCallback(
    async (fetchOptions: Omit<LogOptions, "namespace" | "pod_name"> = {}) => {
      if (!namespace || !podName) return;

      setIsLoading(true);
      setError(null);

      try {
        const logOptions: LogOptions = {
          namespace,
          pod_name: podName,
          container: selectedContainer || undefined,
          timestamps: true,
          tail_lines: fetchOptions.tail_lines ?? 500,
          ...fetchOptions,
        };

        const fetchedLogs = await getPodLogs(logOptions);
        if (flushTimeoutRef.current) {
          clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = null;
        }
        pendingLogsRef.current = [];
        const nextLogs = fetchedLogs.slice(-maxLines);
        logsRef.current = nextLogs;
        setLogs([...nextLogs]);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Failed to fetch logs";
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [namespace, podName, selectedContainer, maxLines]
  );

  const startStream = useCallback(
    async (streamOptions: Omit<LogOptions, "namespace" | "pod_name"> = {}) => {
      if (!namespace || !podName || isStreaming) return;

      // Stop any existing stream
      if (streamIdRef.current) {
        flushPendingLogs();
        await stopLogStream(streamIdRef.current).catch(console.error);
        if (unlistenRef.current) {
          unlistenRef.current();
          unlistenRef.current = null;
        }
      }

      const streamId = `logs-${namespace}-${podName}-${Date.now()}`;
      streamIdRef.current = streamId;

      setError(null);

      try {
        // Set up event listener before starting stream
        const eventName = `log-stream-${streamId}`;
        unlistenRef.current = await listen<LogEvent>(eventName, (event) => {
          const logEvent = event.payload;

          switch (logEvent.type) {
            case "Line":
              enqueueLog(logEvent.data);
              break;
            case "Error":
              flushPendingLogs();
              setError(logEvent.data);
              setIsStreaming(false);
              break;
            case "Started":
              setIsStreaming(true);
              break;
            case "Stopped":
              flushPendingLogs();
              setIsStreaming(false);
              streamIdRef.current = null;
              break;
          }
        });

        const logOptions: LogOptions = {
          namespace,
          pod_name: podName,
          container: selectedContainer || undefined,
          follow: true,
          timestamps: true,
          tail_lines: streamOptions.tail_lines ?? 100,
          ...streamOptions,
        };

        await streamPodLogs(streamId, logOptions);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Failed to start log stream";
        setError(errorMsg);
        setIsStreaming(false);
        streamIdRef.current = null;
      }
    },
    [namespace, podName, selectedContainer, isStreaming, enqueueLog, flushPendingLogs]
  );

  const stopStream = useCallback(async () => {
    if (!streamIdRef.current) return;

    try {
      await stopLogStream(streamIdRef.current);
    } catch (e) {
      console.error("Failed to stop stream:", e);
    } finally {
      flushPendingLogs();
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      streamIdRef.current = null;
      setIsStreaming(false);
    }
  }, [flushPendingLogs]);

  const clearLogs = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    pendingLogsRef.current = [];
    logsRef.current = [];
    setLogs([]);
    setError(null);
  }, []);

  const downloadLogs = useCallback(async (): Promise<string> => {
    if (!namespace || !podName) {
      throw new Error("No pod selected");
    }

    const logOptions: LogOptions = {
      namespace,
      pod_name: podName,
      container: selectedContainer || undefined,
      timestamps: true,
    };

    return downloadPodLogs(logOptions);
  }, [namespace, podName, selectedContainer]);

  const searchLogs = useCallback(
    (query: string): LogEntry[] => {
      if (!query) return logs;
      const lowerQuery = query.toLowerCase();
      return logs.filter((log) => log.message.toLowerCase().includes(lowerQuery));
    },
    [logs]
  );

  return {
    logs,
    isLoading,
    isStreaming,
    error,
    containers,
    selectedContainer,
    setSelectedContainer,
    fetchLogs,
    startStream,
    stopStream,
    clearLogs,
    downloadLogs,
    searchLogs,
  };
}

// Hook for managing multiple log streams
export interface LogStreamState {
  id: string;
  namespace: string;
  podName: string;
  container: string | null;
  logs: LogEntry[];
  isStreaming: boolean;
  error: string | null;
}

export function useMultiLogs() {
  const [streams, setStreams] = useState<Map<string, LogStreamState>>(new Map());

  const addStream = useCallback((id: string, namespace: string, podName: string) => {
    setStreams((prev) => {
      const newMap = new Map(prev);
      newMap.set(id, {
        id,
        namespace,
        podName,
        container: null,
        logs: [],
        isStreaming: false,
        error: null,
      });
      return newMap;
    });
  }, []);

  const removeStream = useCallback((id: string) => {
    setStreams((prev) => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const getStream = useCallback((id: string) => streams.get(id), [streams]);

  return {
    streams: Array.from(streams.values()),
    addStream,
    removeStream,
    getStream,
  };
}
