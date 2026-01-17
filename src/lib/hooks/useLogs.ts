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

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [containers, setContainers] = useState<string[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);

  const streamIdRef = useRef<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamIdRef.current) {
        stopLogStream(streamIdRef.current).catch(console.error);
      }
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);

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
        setLogs(fetchedLogs.slice(-maxLines));
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
              setLogs((prev) => {
                const newLogs = [...prev, logEvent.data];
                // Keep only maxLines
                if (newLogs.length > maxLines) {
                  return newLogs.slice(-maxLines);
                }
                return newLogs;
              });
              break;
            case "Error":
              setError(logEvent.data);
              setIsStreaming(false);
              break;
            case "Started":
              setIsStreaming(true);
              break;
            case "Stopped":
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
    [namespace, podName, selectedContainer, isStreaming, maxLines]
  );

  const stopStream = useCallback(async () => {
    if (!streamIdRef.current) return;

    try {
      await stopLogStream(streamIdRef.current);
    } catch (e) {
      console.error("Failed to stop stream:", e);
    } finally {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      streamIdRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const clearLogs = useCallback(() => {
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
