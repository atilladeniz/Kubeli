import type { K8sTemplate } from "./types";

const CATEGORY = "Configuration";

export const configurationTemplates: K8sTemplate[] = [
  {
    kind: "ConfigMap",
    apiVersion: "v1",
    category: CATEGORY,
    yaml: `apiVersion: v1
kind: ConfigMap
metadata:
  name: my-configmap
  namespace: default
data:
  key1: value1
  key2: value2
  config.yaml: |
    setting: true
    debug: false
`,
  },
  {
    kind: "Secret",
    apiVersion: "v1",
    category: CATEGORY,
    yaml: `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
  namespace: default
type: Opaque
stringData:
  username: admin
  password: changeme
`,
  },
  {
    kind: "HorizontalPodAutoscaler",
    apiVersion: "autoscaling/v2",
    category: CATEGORY,
    yaml: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-hpa
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-deployment
  minReplicas: 1
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 80
`,
  },
  {
    kind: "LimitRange",
    apiVersion: "v1",
    category: CATEGORY,
    yaml: `apiVersion: v1
kind: LimitRange
metadata:
  name: my-limit-range
  namespace: default
spec:
  limits:
    - type: Container
      default:
        cpu: "500m"
        memory: "256Mi"
      defaultRequest:
        cpu: "100m"
        memory: "128Mi"
`,
  },
  {
    kind: "ResourceQuota",
    apiVersion: "v1",
    category: CATEGORY,
    yaml: `apiVersion: v1
kind: ResourceQuota
metadata:
  name: my-resource-quota
  namespace: default
spec:
  hard:
    pods: "10"
    requests.cpu: "4"
    requests.memory: "8Gi"
    limits.cpu: "8"
    limits.memory: "16Gi"
`,
  },
  {
    kind: "PodDisruptionBudget",
    apiVersion: "policy/v1",
    category: CATEGORY,
    yaml: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: my-pdb
  namespace: default
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: my-app
`,
  },
];
