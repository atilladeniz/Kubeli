"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { K8sEvent } from "../types";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

interface EventsTabProps {
  events: K8sEvent[];
}

export function EventsTab({ events }: EventsTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {events.map((event, idx) => (
          <div
            key={idx}
            className={cn(
              "rounded-lg border p-3",
              event.type === "Warning"
                ? "border-yellow-500/30 bg-yellow-500/5"
                : "border-border bg-muted/30"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{event.reason}</span>
              <div className="flex items-center gap-2">
                {event.count > 1 && (
                  <Badge variant="secondary">{event.count}x</Badge>
                )}
                <Badge
                  variant={
                    event.type === "Warning"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {event.type}
                </Badge>
              </div>
            </div>
            <p className="text-sm">{event.message}</p>
            {event.lastTimestamp && (
              <p className="text-xs text-muted-foreground mt-2">
                Last seen: {formatDate(event.lastTimestamp)}
              </p>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
