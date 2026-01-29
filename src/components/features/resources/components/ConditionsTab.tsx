"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Condition } from "../types";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

interface ConditionsTabProps {
  conditions: Condition[];
}

export function ConditionsTab({ conditions }: ConditionsTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {conditions.map((condition, idx) => (
          <div
            key={idx}
            className={cn(
              "rounded-lg border p-3",
              condition.status === "True"
                ? "border-green-500/30 bg-green-500/5"
                : condition.status === "False"
                ? "border-red-500/30 bg-red-500/5"
                : "border-border bg-muted/30"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{condition.type}</span>
              <Badge
                variant={
                  condition.status === "True" ? "default" : "secondary"
                }
                className={cn(
                  condition.status === "True" && "bg-green-500",
                  condition.status === "False" && "bg-red-500"
                )}
              >
                {condition.status}
              </Badge>
            </div>
            {condition.reason && (
              <p className="text-sm text-muted-foreground">
                Reason: {condition.reason}
              </p>
            )}
            {condition.message && (
              <p className="text-sm mt-1">{condition.message}</p>
            )}
            {condition.lastTransitionTime && (
              <p className="text-xs text-muted-foreground mt-2">
                Last transition:{" "}
                {formatDate(condition.lastTransitionTime)}
              </p>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
