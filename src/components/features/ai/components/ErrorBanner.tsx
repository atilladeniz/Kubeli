"use client";

import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBannerProps {
  error: string;
  onDismiss: () => void;
}

/**
 * Error banner displayed when AI session encounters an error.
 */
export function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive text-sm border-b border-destructive/20">
      <AlertCircle className="size-4 shrink-0" />
      <span className="flex-1 text-xs">{error}</span>
      <Button
        variant="ghost"
        size="sm"
        className="size-6 p-0 hover:bg-destructive/20"
        onClick={onDismiss}
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}
