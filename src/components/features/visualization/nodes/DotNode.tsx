"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { GraphNodeStatus } from "@/lib/types";

export interface DotNodeData {
  name: string;
  status: GraphNodeStatus;
  isHighlighted?: boolean;
  isSelected?: boolean;
}

interface DotNodeProps {
  data: DotNodeData;
}

const statusColors: Record<GraphNodeStatus, string> = {
  healthy: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
  unknown: "bg-gray-400",
};

function DotNodeComponent({ data }: DotNodeProps) {
  const { name, status, isHighlighted, isSelected } = data;
  const statusColor = statusColors[status];

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-transparent !border-0 !w-0 !h-0"
      />

      <div
        className={cn(
          "size-3 rounded-full transition-all",
          statusColor,
          isHighlighted && "ring-2 ring-primary ring-offset-1",
          isSelected && "ring-2 ring-blue-500 ring-offset-1"
        )}
        title={name}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-transparent !border-0 !w-0 !h-0"
      />
    </>
  );
}

export const DotNode = memo(DotNodeComponent);
