import type { ViewContext } from "../hooks/useViewContext";

/** Interval in ms between thinking message changes */
export const THINKING_MESSAGE_INTERVAL = 1800;

/** Quick prompt suggestions shown in empty state */
export const QUICK_PROMPTS = [
  "What pods are failing?",
  "Show deployment status",
  "Analyze pod logs",
  "Any resource issues?",
] as const;

const VIEW_PROMPTS: Partial<Record<string, string[]>> = {
  "pod-logs": [
    "What errors are in these logs?",
    "Summarize recent log activity",
    "Any warnings or anomalies?",
    "What is this pod doing?",
  ],
  pods: [
    "Which pods are unhealthy?",
    "Any crash loops?",
    "Show pod resource usage",
    "Any recent restarts?",
  ],
  deployments: [
    "Which deployments need attention?",
    "Any rollout issues?",
    "Show replica status",
    "Any failed deployments?",
  ],
  services: [
    "Any services without endpoints?",
    "Show service configuration",
    "Any port mismatches?",
    "List exposed services",
  ],
  events: [
    "What warnings occurred recently?",
    "Any recurring issues?",
    "Summarize recent events",
    "Any failed scheduling?",
  ],
  nodes: [
    "Any unhealthy nodes?",
    "Show node resource pressure",
    "Any taints or conditions?",
    "Node capacity overview",
  ],
  "helm-releases": [
    "Any failed Helm releases?",
    "Show release versions",
    "Any pending upgrades?",
    "Check release health",
  ],
  ingresses: [
    "Any misconfigured ingresses?",
    "Show ingress routing",
    "Any TLS issues?",
    "List ingress hosts",
  ],
  configmaps: [
    "Any unused ConfigMaps?",
    "Show ConfigMap details",
    "Any large ConfigMaps?",
    "Check for sensitive data",
  ],
  secrets: [
    "Any expiring secrets?",
    "Show secret types and key names",
    "Any unused secrets?",
    "Check secret annotations",
  ],
};

/**
 * Returns contextual quick prompts based on the current view.
 * Prepends a resource-specific prompt when a resource is selected.
 */
export function getContextualPrompts(ctx: ViewContext): string[] {
  const viewPrompts = VIEW_PROMPTS[ctx.activeView];
  const base = viewPrompts ?? [...QUICK_PROMPTS];

  // Prepend a resource-specific prompt if a resource is selected
  if (ctx.selectedResource) {
    const { type, name } = ctx.selectedResource;
    const analyzePrompt = `Analyze ${type} "${name}"`;
    return [analyzePrompt, ...base.slice(0, 3)];
  }

  return [...base];
}
