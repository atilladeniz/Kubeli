"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Box, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNamespaceColor } from "@/lib/utils/colors";
import type { GraphNodeStatus, GraphNodeType } from "@/lib/types";

export interface ResourceNodeData {
  name: string;
  nodeType: GraphNodeType;
  namespace: string;
  status: GraphNodeStatus;
  readyStatus?: string | null;
  replicas?: string | null;
  isHighlighted?: boolean;
  isSelected?: boolean;
}

interface ResourceNodeProps {
  data: ResourceNodeData;
}

// Simplified icons for 3 node types
const nodeIcons: Record<GraphNodeType, React.ReactNode> = {
  namespace: <Layers className="size-3.5" />,
  deployment: <Box className="size-3.5" />,
  pod: <Box className="size-3.5" />,
};

// Simplified labels for 3 node types
const nodeLabels: Record<GraphNodeType, string> = {
  namespace: "NS",
  deployment: "Deploy",
  pod: "Pod",
};

const statusColors: Record<GraphNodeStatus, string> = {
  healthy: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
  unknown: "bg-gray-400",
};

function ResourceNodeComponent({ data }: ResourceNodeProps) {
  const { name, nodeType, namespace, status, readyStatus, replicas, isHighlighted, isSelected } = data;

  const icon = nodeIcons[nodeType] || <Box className="size-3.5" />;
  const label = nodeLabels[nodeType] || nodeType;
  const statusColor = statusColors[status];
  const namespaceColor = getNamespaceColor(namespace);
  const displayName = name.length > 24 ? `${name.slice(0, 22)}...` : name;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground/50 !border-0 !w-2 !h-2 opacity-0"
      />

      <div
        className={cn(
          "rounded-lg border bg-card shadow-sm overflow-hidden flex",
          isHighlighted && "ring-2 ring-primary ring-offset-2",
          isSelected && "ring-2 ring-blue-500 ring-offset-2"
        )}
      >
        {/* Namespace color stripe on left */}
        <div className={cn("w-1 shrink-0", namespaceColor.dot)} />

        <div className="flex-1 min-w-0">
          {/* Header with type label */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 border-b">
            <span className={cn("size-2 rounded-full shrink-0", statusColor)} />
            <span className="text-muted-foreground">{icon}</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </span>
            {(readyStatus || replicas) && (
              <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                {readyStatus || replicas}
              </span>
            )}
          </div>

          {/* Name */}
          <div className="px-2.5 py-2">
            <p className="text-xs font-medium truncate" title={name}>
              {displayName}
            </p>
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

// Memoize to prevent unnecessary re-renders
export const ResourceNode = memo(ResourceNodeComponent);
