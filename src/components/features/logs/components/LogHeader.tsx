"use client";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LogHeaderProps {
  title: string;
  podName: string;
  namespace: string;
  isStreaming: boolean;
  streamingLabel: string;
  containers: string[];
  selectedContainer: string | null;
  onContainerChange: (container: string | null) => void;
  containerPlaceholder: string;
}

/**
 * Header component for the log viewer.
 * Shows pod name, namespace, streaming status, and container selector.
 */
export function LogHeader({
  title,
  podName,
  namespace,
  isStreaming,
  streamingLabel,
  containers,
  selectedContainer,
  onContainerChange,
  containerPlaceholder,
}: LogHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2">
      <div className="flex items-center gap-3">
        <h3 className="font-medium">
          {title}: {podName}
        </h3>
        <Badge variant="secondary">{namespace}</Badge>
        {isStreaming && (
          <Badge variant="default" className="bg-green-500/10 text-green-500 gap-1">
            <span className="size-2 animate-pulse rounded-full bg-green-500" />
            {streamingLabel}
          </Badge>
        )}
      </div>

      {/* Container selector */}
      {containers.length > 1 && (
        <Select
          value={selectedContainer || ""}
          onValueChange={(value) => onContainerChange(value || null)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={containerPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {containers.map((container) => (
              <SelectItem key={container} value={container}>
                {container}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
