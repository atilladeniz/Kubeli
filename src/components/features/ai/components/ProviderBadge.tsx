"use client";

import { cn } from "@/lib/utils";
import { useUIStore, type AiCliProvider } from "@/lib/stores/ui-store";

const STYLES: Record<AiCliProvider, { className: string; label: string }> = {
  claude: { className: "bg-orange-500/10 text-orange-500", label: "Claude" },
  codex: { className: "bg-emerald-500/10 text-emerald-500", label: "Codex" },
  opencode: { className: "bg-sky-500/10 text-sky-500", label: "OpenCode" },
  droid: { className: "bg-violet-500/10 text-violet-500", label: "Droid" },
};

/**
 * Badge showing which AI CLI provider is being used.
 */
export function ProviderBadge() {
  const settings = useUIStore((s) => s.settings);
  const provider: AiCliProvider = settings.aiCliProvider || "claude";
  const style = STYLES[provider] ?? STYLES.claude;

  return (
    <span
      className={cn(
        "text-xs font-medium px-1.5 py-0.5 rounded-full",
        style.className
      )}
    >
      {style.label}
    </span>
  );
}
