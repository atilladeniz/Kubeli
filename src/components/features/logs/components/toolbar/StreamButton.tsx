"use client";

import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StreamButtonProps {
  isStreaming: boolean;
  isLoading: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  followLabel: string;
  pausedLabel: string;
}

export function StreamButton({
  isStreaming,
  isLoading,
  disabled,
  onStart,
  onStop,
  followLabel,
  pausedLabel,
}: StreamButtonProps) {
  if (isStreaming) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onStop}
        className="h-7 text-xs text-yellow-500 hover:text-yellow-600"
      >
        <Pause className="size-3.5" />
        {pausedLabel}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onStart}
      disabled={isLoading || disabled}
      className="h-7 text-xs text-green-500 hover:text-green-600"
    >
      <Play className="size-3.5" />
      {followLabel}
    </Button>
  );
}
