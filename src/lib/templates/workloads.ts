import type { K8sTemplate } from "./types";

const CATEGORY = "Workloads";

export const workloadTemplates: K8sTemplate[] = [
  {
    kind: "Pod",
    apiVersion: "v1",
    category: CATEGORY,
    yaml: `apiVersion: v1
kind: Pod
metadata:
  name: kubeli-explorer
  namespace: default
  labels:
    app: kubeli-explorer
    managed-by: kubeli
spec:
  containers:
    - name: main
      image: nginx:latest
      ports:
        - containerPort: 80
`,
  },
  {
    kind: "Deployment",
    apiVersion: "apps/v1",
    category: CATEGORY,
    yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
  namespace: default
  labels:
    app: my-deployment
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-deployment
  template:
    metadata:
      labels:
        app: my-deployment
    spec:
      containers:
        - name: main
          image: nginx:latest
          ports:
            - containerPort: 80
`,
  },
  {
    kind: "ReplicaSet",
    apiVersion: "apps/v1",
    category: CATEGORY,
    yaml: `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: my-replicaset
  namespace: default
  labels:
    app: my-replicaset
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-replicaset
  template:
    metadata:
      labels:
        app: my-replicaset
    spec:
      containers:
        - name: main
          image: nginx:latest
`,
  },
  {
    kind: "ReplicationController",
    apiVersion: "v1",
    category: CATEGORY,
    yaml: `apiVersion: v1
kind: ReplicationController
metadata:
  name: my-rc
  namespace: default
spec:
  replicas: 1
  selector:
    app: my-rc
  template:
    metadata:
      labels:
        app: my-rc
    spec:
      containers:
        - name: main
          image: nginx:latest
`,
  },
  {
    kind: "DaemonSet",
    apiVersion: "apps/v1",
    category: CATEGORY,
    yaml: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: my-daemonset
  namespace: default
  labels:
    app: my-daemonset
spec:
  selector:
    matchLabels:
      app: my-daemonset
  template:
    metadata:
      labels:
        app: my-daemonset
    spec:
      containers:
        - name: main
          image: busybox:latest
          command: ["sleep", "infinity"]
`,
  },
  {
    kind: "StatefulSet",
    apiVersion: "apps/v1",
    category: CATEGORY,
    yaml: `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: my-statefulset
  namespace: default
  labels:
    app: my-statefulset
spec:
  replicas: 1
  serviceName: my-statefulset
  selector:
    matchLabels:
      app: my-statefulset
  template:
    metadata:
      labels:
        app: my-statefulset
    spec:
      containers:
        - name: main
          image: nginx:latest
          ports:
            - containerPort: 80
`,
  },
  {
    kind: "Job",
    apiVersion: "batch/v1",
    category: CATEGORY,
    yaml: `apiVersion: batch/v1
kind: Job
metadata:
  name: my-job
  namespace: default
spec:
  template:
    spec:
      containers:
        - name: main
          image: busybox:latest
          command: ["echo", "Hello from Kubeli"]
      restartPolicy: Never
  backoffLimit: 3
`,
  },
  {
    kind: "CronJob",
    apiVersion: "batch/v1",
    category: CATEGORY,
    yaml: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: my-cronjob
  namespace: default
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: main
              image: busybox:latest
              command: ["echo", "Hello from Kubeli"]
          restartPolicy: OnFailure
`,
  },
];
