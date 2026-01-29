export interface ResourceData {
  name: string;
  namespace?: string;
  uid: string;
  apiVersion?: string;
  kind?: string;
  createdAt?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  yaml?: string;
  status?: Record<string, unknown>;
  spec?: Record<string, unknown>;
  conditions?: Condition[];
  events?: K8sEvent[];
}

export interface Condition {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface K8sEvent {
  type: string;
  reason: string;
  message: string;
  count: number;
  lastTimestamp?: string;
  firstTimestamp?: string;
}

export interface ResourceDetailProps {
  resource: ResourceData | null;
  resourceType: string;
  onClose: () => void;
  onSave?: (yaml: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  isLoading?: boolean;
}
