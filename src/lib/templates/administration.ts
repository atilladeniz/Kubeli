import type { K8sTemplate } from "./types";

const CATEGORY = "Administration";

export const administrationTemplates: K8sTemplate[] = [
  {
    kind: "CustomResourceDefinition",
    apiVersion: "apiextensions.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: myresources.example.com
spec:
  group: example.com
  names:
    kind: MyResource
    listKind: MyResourceList
    plural: myresources
    singular: myresource
    shortNames:
      - mr
  scope: Namespaced
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                message:
                  type: string
`,
  },
  {
    kind: "PriorityClass",
    apiVersion: "scheduling.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: my-priority-class
value: 1000
globalDefault: false
description: "Custom priority class"
`,
  },
  {
    kind: "RuntimeClass",
    apiVersion: "node.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: my-runtime-class
handler: my-handler
`,
  },
  {
    kind: "Lease",
    apiVersion: "coordination.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: coordination.k8s.io/v1
kind: Lease
metadata:
  name: my-lease
  namespace: default
spec:
  holderIdentity: my-holder
  leaseDurationSeconds: 30
`,
  },
  {
    kind: "MutatingWebhookConfiguration",
    apiVersion: "admissionregistration.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: my-mutating-webhook
webhooks:
  - name: my-webhook.example.com
    admissionReviewVersions: ["v1"]
    sideEffects: None
    clientConfig:
      service:
        name: my-webhook-service
        namespace: default
        path: /mutate
    rules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE"]
        resources: ["pods"]
`,
  },
  {
    kind: "ValidatingWebhookConfiguration",
    apiVersion: "admissionregistration.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: my-validating-webhook
webhooks:
  - name: my-webhook.example.com
    admissionReviewVersions: ["v1"]
    sideEffects: None
    clientConfig:
      service:
        name: my-webhook-service
        namespace: default
        path: /validate
    rules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE"]
        resources: ["pods"]
`,
  },
  {
    kind: "VerticalPodAutoscaler",
    apiVersion: "autoscaling.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: my-vpa
  namespace: default
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-deployment
  updatePolicy:
    updateMode: "Auto"
`,
  },
];
