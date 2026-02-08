"use client";

import { BooleanStatusBadge } from "./BooleanStatusBadge";

export function CronJobSuspendBadge({ suspend }: { suspend: boolean }) {
  return <BooleanStatusBadge value={suspend} variant="activeSuspended" />;
}
