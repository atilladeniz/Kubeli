import {
  TEMPLATE_CATEGORIES,
  getTemplatesByCategory,
  k8sTemplates,
} from "../k8s-templates";

describe("k8s templates", () => {
  it("covers every template category with at least one template", () => {
    const grouped = getTemplatesByCategory();

    expect(TEMPLATE_CATEGORIES).toEqual([
      "Workloads",
      "Networking",
      "Configuration",
      "Storage",
      "Access Control",
      "Administration",
    ]);

    for (const category of TEMPLATE_CATEGORIES) {
      expect(grouped[category].length).toBeGreaterThan(0);
      expect(grouped[category].every((template) => template.category === category)).toBe(true);
    }
  });

  it("aggregates the full template catalog with valid yaml snippets", () => {
    expect(k8sTemplates.length).toBe(35);

    const kinds = new Set(k8sTemplates.map((template) => template.kind));
    expect(kinds).toEqual(
      new Set([
        "Pod",
        "Deployment",
        "ReplicaSet",
        "ReplicationController",
        "DaemonSet",
        "StatefulSet",
        "Job",
        "CronJob",
        "Service",
        "Ingress",
        "IngressClass",
        "NetworkPolicy",
        "EndpointSlice",
        "ConfigMap",
        "Secret",
        "HorizontalPodAutoscaler",
        "LimitRange",
        "ResourceQuota",
        "PodDisruptionBudget",
        "PersistentVolume",
        "PersistentVolumeClaim",
        "StorageClass",
        "Namespace",
        "ServiceAccount",
        "Role",
        "RoleBinding",
        "ClusterRole",
        "ClusterRoleBinding",
        "CustomResourceDefinition",
        "PriorityClass",
        "RuntimeClass",
        "Lease",
        "MutatingWebhookConfiguration",
        "ValidatingWebhookConfiguration",
        "VerticalPodAutoscaler",
      ])
    );

    for (const template of k8sTemplates) {
      expect(template.yaml).toContain(`kind: ${template.kind}`);
      expect(template.yaml).toContain(`apiVersion: ${template.apiVersion}`);
    }
  });
});
