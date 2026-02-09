export interface K8sTemplate {
  kind: string;
  apiVersion: string;
  category: string;
  yaml: string;
}

export const TEMPLATE_CATEGORIES = [
  "Workloads",
  "Networking",
  "Configuration",
  "Storage",
  "Access Control",
  "Administration",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
