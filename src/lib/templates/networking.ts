import type { K8sTemplate } from "./types";

const CATEGORY = "Networking";

export const networkingTemplates: K8sTemplate[] = [
  {
    kind: "Service",
    apiVersion: "v1",
    category: CATEGORY,
    yaml: `apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: default
spec:
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 80
      protocol: TCP
  type: ClusterIP
`,
  },
  {
    kind: "Ingress",
    apiVersion: "networking.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  namespace: default
spec:
  rules:
    - host: example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-service
                port:
                  number: 80
`,
  },
  {
    kind: "IngressClass",
    apiVersion: "networking.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: my-ingress-class
spec:
  controller: k8s.io/ingress-nginx
`,
  },
  {
    kind: "NetworkPolicy",
    apiVersion: "networking.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: my-network-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: my-app
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: allowed-app
      ports:
        - port: 80
          protocol: TCP
`,
  },
  {
    kind: "EndpointSlice",
    apiVersion: "discovery.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: my-endpoint-slice
  namespace: default
  labels:
    kubernetes.io/service-name: my-service
addressType: IPv4
ports:
  - name: http
    port: 80
    protocol: TCP
endpoints:
  - addresses:
      - "10.0.0.1"
    conditions:
      ready: true
`,
  },
];
