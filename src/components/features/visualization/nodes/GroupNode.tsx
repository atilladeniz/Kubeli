"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { getNamespaceColor } from "@/lib/utils/colors";
import type { GraphNodeStatus, GraphNodeType } from "@/lib/types";

export interface GroupNodeData {
  name: string;
  nodeType: GraphNodeType;
  namespace: string;
  status: GraphNodeStatus;
  childCount?: number | null;
  isHighlighted?: boolean;
  isSelected?: boolean;
}

interface GroupNodeProps {
  data: GroupNodeData;
}

const statusColors: Record<GraphNodeStatus, string> = {
  healthy: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
  unknown: "bg-gray-400",
};

function GroupNodeComponent({ data }: GroupNodeProps) {
  const { name, nodeType, namespace, status, childCount, isHighlighted, isSelected } = data;
  const statusColor = statusColors[status];
  const namespaceColor = getNamespaceColor(namespace);

  // Namespace nodes get colored border, deployment nodes get lighter tint
  const isNamespace = nodeType === "namespace";

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground/50 !border-0 !w-2 !h-2 opacity-0"
      />

      {/* Labeled Group Node Style with namespace color */}
      <div
        className={cn(
          "w-full h-full rounded-lg border-2",
          isNamespace ? namespaceColor.border : "border-border/50",
          isNamespace ? namespaceColor.bgLight : "bg-muted/10",
          isHighlighted && "ring-2 ring-primary ring-offset-2",
          isSelected && "ring-2 ring-blue-500 ring-offset-2"
        )}
      >
        {/* Label in top-left corner with namespace color accent */}
        <div className="absolute -top-px -left-px">
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-tl-lg rounded-br-lg",
              "border-r border-b text-sm font-medium",
              isNamespace ? [namespaceColor.bgLight, "border-inherit"] : "bg-muted"
            )}
          >
            {/* Namespace color dot */}
            <span className={cn("size-2.5 rounded-full shrink-0", namespaceColor.dot)} />
            {/* Status indicator (smaller, overlaid) */}
            <span className={cn("size-1.5 rounded-full shrink-0 -ml-2.5 mt-1.5", statusColor)} />
            <span className="truncate max-w-[180px]">{name}</span>
            {childCount !== undefined && childCount !== null && childCount > 0 && (
              <span className="text-xs text-muted-foreground">
                ({childCount})
              </span>
            )}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground/50 !border-0 !w-2 !h-2 opacity-0"
      />
    </>
  );
}

export const GroupNode = memo(GroupNodeComponent);
