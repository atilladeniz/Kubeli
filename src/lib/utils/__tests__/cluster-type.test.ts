import {
  detectClusterType,
  getClusterIconPath,
  getClusterTypeLabel,
} from "../cluster-type";

const baseCluster = {
  name: "demo",
  context: "demo",
  server: "https://cluster.example.com",
};

describe("detectClusterType", () => {
  it("detects minikube", () => {
    const type = detectClusterType({
      ...baseCluster,
      name: "minikube",
      context: "minikube",
      server: "https://127.0.0.1:8443",
    });
    expect(type).toBe("minikube");
  });

  it("detects eks", () => {
    const type = detectClusterType({
      ...baseCluster,
      context: "arn:aws:eks:us-west-2:123456789012:cluster/demo",
      server: "https://ABC.gr7.us-west-2.eks.amazonaws.com",
    });
    expect(type).toBe("eks");
  });

  it("detects gke", () => {
    const type = detectClusterType({
      ...baseCluster,
      context: "gke_project_us-central1_demo",
      server: "https://container.googleapis.com/v1/projects/demo",
    });
    expect(type).toBe("gke");
  });

  it("detects aks", () => {
    const type = detectClusterType({
      ...baseCluster,
      context: "kubeli-aks-demo",
      server: "https://demo.azmk8s.io",
    });
    expect(type).toBe("aks");
  });

  it("falls back to kubernetes", () => {
    const type = detectClusterType(baseCluster);
    expect(type).toBe("kubernetes");
  });
});

describe("cluster type helpers", () => {
  it("returns icon path for each type", () => {
    expect(getClusterIconPath("minikube")).toBe("/minikube.svg");
    expect(getClusterIconPath("eks")).toBe("/amazoneks.svg");
    expect(getClusterIconPath("gke")).toBe("/googlekubernetesengine.svg");
    expect(getClusterIconPath("aks")).toBe("/azureaks.svg");
    expect(getClusterIconPath("kubernetes")).toBe("/kubernets.svg");
  });

  it("returns human labels", () => {
    expect(getClusterTypeLabel("minikube")).toBe("Minikube");
    expect(getClusterTypeLabel("eks")).toBe("Amazon EKS");
    expect(getClusterTypeLabel("gke")).toBe("Google GKE");
    expect(getClusterTypeLabel("aks")).toBe("Azure AKS");
    expect(getClusterTypeLabel("kubernetes")).toBe("Kubernetes");
  });
});
