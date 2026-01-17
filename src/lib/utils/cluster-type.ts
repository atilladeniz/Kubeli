export type ClusterType = "minikube" | "eks" | "gke" | "aks" | "kubernetes";

interface ClusterInfo {
  name: string;
  context: string;
  server: string;
}

/**
 * Detects the cluster type based on context name, cluster name, and server URL
 */
export function detectClusterType(cluster: ClusterInfo): ClusterType {
  const context = cluster.context.toLowerCase();
  const name = cluster.name.toLowerCase();
  const server = cluster.server.toLowerCase();

  // Minikube detection
  if (
    context.includes("minikube") ||
    name.includes("minikube") ||
    server.includes("127.0.0.1") ||
    server.includes("192.168.") ||
    server.includes("localhost")
  ) {
    return "minikube";
  }

  // AWS EKS detection
  if (
    context.includes("eks") ||
    name.includes("eks") ||
    server.includes(".eks.amazonaws.com") ||
    server.includes("amazonaws.com") ||
    context.includes("aws")
  ) {
    return "eks";
  }

  // Google GKE detection
  if (
    context.includes("gke") ||
    name.includes("gke") ||
    server.includes(".googleapis.com") ||
    server.includes("container.googleapis.com") ||
    context.includes("gcp") ||
    context.includes("google")
  ) {
    return "gke";
  }

  // Azure AKS detection
  if (
    context.includes("aks") ||
    name.includes("aks") ||
    server.includes(".azmk8s.io") ||
    server.includes("azure") ||
    context.includes("azure")
  ) {
    return "aks";
  }

  // Default to generic Kubernetes
  return "kubernetes";
}

/**
 * Returns the icon path for a cluster type
 */
export function getClusterIconPath(type: ClusterType): string {
  switch (type) {
    case "minikube":
      return "/minikube.svg";
    case "eks":
      return "/amazoneks.svg";
    case "gke":
      return "/googlekubernetesengine.svg";
    case "aks":
      return "/azureaks.svg";
    case "kubernetes":
    default:
      return "/kubernets.svg";
  }
}

/**
 * Returns a human-readable label for the cluster type
 */
export function getClusterTypeLabel(type: ClusterType): string {
  switch (type) {
    case "minikube":
      return "Minikube";
    case "eks":
      return "Amazon EKS";
    case "gke":
      return "Google GKE";
    case "aks":
      return "Azure AKS";
    case "kubernetes":
    default:
      return "Kubernetes";
  }
}
