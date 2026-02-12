import type { K8sTemplate } from "./types";

const CATEGORY = "Storage";

export const storageTemplates: K8sTemplate[] = [
  {
    kind: "PersistentVolume",
    apiVersion: "v1",
    category: CATEGORY,
    yaml: `apiVersion: v1
kind: PersistentVolume
metadata:
  name: my-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /data/my-pv
`,
  },
  {
    kind: "PersistentVolumeClaim",
    apiVersion: "v1",
    category: CATEGORY,
    yaml: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
`,
  },
  {
    kind: "StorageClass",
    apiVersion: "storage.k8s.io/v1",
    category: CATEGORY,
    yaml: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: my-storage-class
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
`,
  },
];
