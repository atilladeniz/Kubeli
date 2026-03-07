import type { NodeInfo } from "@/lib/types";

export interface NodeSchedulingAction {
  label: "Cordon" | "Uncordon";
  description: string;
  disabled: boolean;
}

export function getNodeSchedulingAction(node: NodeInfo): NodeSchedulingAction {
  if (node.unschedulable) {
    return {
      label: "Uncordon",
      description: `Uncordon ${node.name}`,
      disabled: false,
    };
  }

  return {
    label: "Cordon",
    description: `Cordon ${node.name}`,
    disabled: !node.status.startsWith("Ready"),
  };
}
