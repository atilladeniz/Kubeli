import { invoke } from "./core";

// Watch commands
export async function watchPods(
  watchId: string,
  namespace?: string,
  labelSelector?: string
): Promise<void> {
  return invoke("watch_pods", {
    watchId,
    namespace,
    ...(labelSelector ? { labelSelector } : {}),
  });
}

export async function watchDeployments(
  watchId: string,
  namespace?: string,
  labelSelector?: string
): Promise<void> {
  return invoke("watch_deployments", {
    watchId,
    namespace,
    ...(labelSelector ? { labelSelector } : {}),
  });
}

export async function watchServices(
  watchId: string,
  namespace?: string,
  labelSelector?: string
): Promise<void> {
  return invoke("watch_services", {
    watchId,
    namespace,
    ...(labelSelector ? { labelSelector } : {}),
  });
}

export async function watchStatefulsets(
  watchId: string,
  namespace?: string,
  labelSelector?: string
): Promise<void> {
  return invoke("watch_statefulsets", {
    watchId,
    namespace,
    ...(labelSelector ? { labelSelector } : {}),
  });
}

export async function watchDaemonsets(
  watchId: string,
  namespace?: string,
  labelSelector?: string
): Promise<void> {
  return invoke("watch_daemonsets", {
    watchId,
    namespace,
    ...(labelSelector ? { labelSelector } : {}),
  });
}

export async function watchReplicasets(
  watchId: string,
  namespace?: string,
  labelSelector?: string
): Promise<void> {
  return invoke("watch_replicasets", {
    watchId,
    namespace,
    ...(labelSelector ? { labelSelector } : {}),
  });
}

export async function watchNamespaces(watchId: string): Promise<void> {
  return invoke("watch_namespaces", { watchId });
}

export async function stopWatch(watchId: string): Promise<void> {
  return invoke("stop_watch", { watchId });
}
