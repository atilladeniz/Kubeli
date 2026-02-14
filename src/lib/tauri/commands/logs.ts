import type { LogEntry, LogOptions } from "../../types";

import { invoke } from "./core";

// Log commands
export async function getPodLogs(options: LogOptions): Promise<LogEntry[]> {
  return invoke<LogEntry[]>("get_pod_logs", { options });
}

export async function streamPodLogs(
  streamId: string,
  options: LogOptions
): Promise<void> {
  return invoke("stream_pod_logs", { streamId, options });
}

export async function stopLogStream(streamId: string): Promise<void> {
  return invoke("stop_log_stream", { streamId });
}

export async function getPodContainers(
  namespace: string,
  podName: string
): Promise<string[]> {
  return invoke<string[]>("get_pod_containers", { namespace, podName });
}

export async function downloadPodLogs(options: LogOptions): Promise<string> {
  return invoke<string>("download_pod_logs", { options });
}
