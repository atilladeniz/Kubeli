import type { K8sTemplate } from "./types";

const CATEGORY = "Access Control";

export const accessControlTemplates: K8sTemplate[] = [
  {
    kind: "Namespace",
    apiVersion: "v1",
    category: CATEGORY,
    yaml: `apiVersion: v1
kind: Namespace
metadata:
  name: my-namespace
  labels:
    name: my-namespace
`,
  },
  {
    kind: "ServiceAccount",
    apiVersion: "v1",
    category: CATEGORY,
    yaml: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-service-account
  namespace: default
`,
  },
  {
    kind: "Role",
    apiVersion: "rbac.authorization.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: my-role
  namespace: default
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
`,
  },
  {
    kind: "RoleBinding",
    apiVersion: "rbac.authorization.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: my-role-binding
  namespace: default
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: my-role
subjects:
  - kind: ServiceAccount
    name: my-service-account
    namespace: default
`,
  },
  {
    kind: "ClusterRole",
    apiVersion: "rbac.authorization.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: my-cluster-role
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
`,
  },
  {
    kind: "ClusterRoleBinding",
    apiVersion: "rbac.authorization.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: my-cluster-role-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: my-cluster-role
subjects:
  - kind: ServiceAccount
    name: my-service-account
    namespace: default
`,
  },
];
