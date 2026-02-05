"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useLocale } from "@/components/providers/I18nProvider";
import type { K8sEvent } from "../types";

function formatDate(dateString: string, locale: string): string {
  const date = new Date(dateString);
  const resolvedLocale = locale === "system" ? undefined : locale;
  return date.toLocaleString(resolvedLocale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface EventsTabProps {
  events: K8sEvent[];
}

export function EventsTab({ events }: EventsTabProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <div className="h-full overflow-y-auto">
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
                {t("resourceDetail.lastSeen")}: {formatDate(event.lastTimestamp, locale)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
