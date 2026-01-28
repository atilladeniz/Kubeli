"use client";

import { MessageSquare } from "lucide-react";

interface EmptySessionListProps {
  noSessionsLabel: string;
  startConversationLabel: string;
}

/**
 * Empty state for when there are no saved sessions.
 */
export function EmptySessionList({
  noSessionsLabel,
  startConversationLabel,
}: EmptySessionListProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted/50 mb-3">
        <MessageSquare className="size-5 text-muted-foreground/50" />
      </div>
      <p className="text-xs text-muted-foreground mb-1">{noSessionsLabel}</p>
      <p className="text-[10px] text-muted-foreground/70">
        {startConversationLabel}
      </p>
    </div>
  );
}
