import { invoke } from "./core";

// Watch commands
export async function watchPods(watchId: string, namespace?: string): Promise<void> {
  return invoke("watch_pods", { watchId, namespace });
}

export async function watchNamespaces(watchId: string): Promise<void> {
  return invoke("watch_namespaces", { watchId });
}

export async function stopWatch(watchId: string): Promise<void> {
  return invoke("stop_watch", { watchId });
}
