import type { PodInfo } from "@/lib/types";

/**
 * Returns the effective pod status based on container states.
 * Unlike pod.phase which only shows the Kubernetes phase (Running, Pending, etc.),
 * this function checks container states to show actual issues like CrashLoopBackOff.
 *
 * Priority:
 * 1. Terminating (deletion_timestamp set)
 * 2. Init container issues (Init:ImagePullBackOff, etc.)
 * 3. Container issues (CrashLoopBackOff, ImagePullBackOff, etc.)
 * 4. Pod phase (Running, Pending, Succeeded, Failed)
 */
export function getEffectivePodStatus(pod: PodInfo): string {
  if (pod.deletion_timestamp) return "Terminating";

  const initWaiting = pod.init_containers?.find(
    (c) => c.state === "Waiting" && c.state_reason
  );
  if (initWaiting?.state_reason) {
    return `Init:${initWaiting.state_reason}`;
  }

  const containerWaiting = pod.containers?.find(
    (c) => c.state === "Waiting" && c.state_reason
  );
  if (containerWaiting?.state_reason) {
    return containerWaiting.state_reason;
  }

  return pod.phase;
}

/**
 * Checks if a pod is unhealthy based on effective status.
 * A pod is unhealthy if it's in Running phase but has container issues.
 */
export function isPodUnhealthy(pod: PodInfo): boolean {
  if (pod.phase !== "Running") return false;
  const status = getEffectivePodStatus(pod);
  return status !== "Running";
}

/**
 * Exit code descriptions for common container exit codes.
 */
export function getExitCodeDescription(code: number): string {
  switch (code) {
    case 0:
      return "exitCode.success";
    case 1:
      return "exitCode.error";
    case 137:
      return "exitCode.oomKilled";
    case 143:
      return "exitCode.sigterm";
    case 139:
      return "exitCode.segfault";
    case 126:
      return "exitCode.permissionDenied";
    case 127:
      return "exitCode.commandNotFound";
    case 130:
      return "exitCode.sigint";
    default:
      return code > 128 ? "exitCode.signal" : "exitCode.exit";
  }
}
