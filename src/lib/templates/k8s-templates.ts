export type { K8sTemplate, TemplateCategory } from "./types";
export { TEMPLATE_CATEGORIES } from "./types";

import { TEMPLATE_CATEGORIES } from "./types";
import type { K8sTemplate } from "./types";
import { workloadTemplates } from "./workloads";
import { networkingTemplates } from "./networking";
import { configurationTemplates } from "./configuration";
import { storageTemplates } from "./storage";
import { accessControlTemplates } from "./access-control";
import { administrationTemplates } from "./administration";

export const k8sTemplates: K8sTemplate[] = [
  ...workloadTemplates,
  ...networkingTemplates,
  ...configurationTemplates,
  ...storageTemplates,
  ...accessControlTemplates,
  ...administrationTemplates,
];

export function getTemplatesByCategory(): Record<string, K8sTemplate[]> {
  const grouped: Record<string, K8sTemplate[]> = {};
  for (const category of TEMPLATE_CATEGORIES) {
    grouped[category] = k8sTemplates.filter((t) => t.category === category);
  }
  return grouped;
}
