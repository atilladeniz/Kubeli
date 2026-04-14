// Workloads
export { usePods, useDeployments, useReplicaSets, useDaemonSets, useStatefulSets, useJobs, useCronJobs } from "./workloads";

// Networking
export { useServices, useIngresses, useEndpointSlices, useNetworkPolicies, useIngressClasses } from "./networking";

// Storage
export { usePersistentVolumes, usePersistentVolumeClaims, useStorageClasses, useCSIDrivers, useCSINodes, useVolumeAttachments } from "./storage";

// Configuration
export { useConfigMaps, useSecrets, useHPAs, useLimitRanges, useResourceQuotas, usePDBs } from "./config";

// Access Control
export { useServiceAccounts, useRoles, useRoleBindings, useClusterRoles, useClusterRoleBindings } from "./access";

// Cluster
export { useNodes, useNamespaces, useEvents, useLeases } from "./cluster";

// Extensions
export { useCRDs, useCustomResources, usePriorityClasses, useRuntimeClasses, useMutatingWebhooks, useValidatingWebhooks, useHelmReleases, useFluxKustomizations, useArgoCDApplications } from "./extensions";
