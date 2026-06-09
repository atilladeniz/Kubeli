"use client";

import { Maximize2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  onOpenInTab?: () => void;
  openInTabTooltip?: string;
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
  onOpenInTab,
  openInTabTooltip,
}: LogHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
      <div className="flex items-center gap-3 min-w-0">
        <h3 className="font-medium truncate">
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

      <div className="flex items-center gap-2 shrink-0">
        {/* Container selector */}
        {containers.length > 1 && (
          <Select
            value={selectedContainer || ""}
            onValueChange={(value) => onContainerChange(value || null)}
          >
            <SelectTrigger className="w-40 shrink-0">
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
        {onOpenInTab && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" onClick={onOpenInTab}>
                  <Maximize2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{openInTabTooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
