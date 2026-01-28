"use client";

import { cn } from "@/lib/utils";
import { useUIStore } from "@/lib/stores/ui-store";

/**
 * Badge showing which AI CLI provider is being used (Claude or Codex).
 */
export function ProviderBadge() {
  const { settings } = useUIStore();
  const provider = settings.aiCliProvider || "claude";

  return (
    <span
      className={cn(
        "text-[9px] font-medium px-1.5 py-0.5 rounded-full",
        provider === "claude"
          ? "bg-orange-500/10 text-orange-500"
          : "bg-emerald-500/10 text-emerald-500"
      )}
    >
      {provider === "claude" ? "Claude" : "Codex"}
    </span>
  );
}
