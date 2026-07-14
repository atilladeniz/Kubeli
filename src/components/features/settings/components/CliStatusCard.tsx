import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { CliStatusCardProps } from "../types";

const STATUS_META = {
  authenticated: { dot: "bg-green-500", text: "text-green-500", key: "authenticated" },
  notauthenticated: { dot: "bg-yellow-500", text: "text-yellow-500", key: "notAuthenticated" },
  notinstalled: { dot: "bg-red-500", text: "text-red-500", key: "notInstalled" },
  error: { dot: "bg-red-500", text: "text-red-500", key: "error" },
} as const;

export function CliStatusCard({
  name,
  info,
  isChecking,
  isSelected,
  installInstructions,
  translations,
}: CliStatusCardProps) {
  const tc = useTranslations("common");

  const meta =
    info && info.status in STATUS_META
      ? STATUS_META[info.status as keyof typeof STATUS_META]
      : null;
  const statusLabel = meta
    ? meta.key === "error"
      ? tc("error")
      : translations?.[meta.key as keyof typeof translations] ?? meta.key
    : !info && isChecking
      ? translations?.checking ?? "Checking…"
      : translations?.clickRefresh ?? "—";

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "border-surface-border bg-surface-2 flex items-center gap-3 rounded-lg border px-3.5 py-3",
          isSelected && "ring-brand/40 ring-1"
        )}
      >
        {/* Status dot */}
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            meta ? meta.dot : "bg-muted-foreground/40",
            !info && isChecking && "animate-pulse"
          )}
        />

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{name}</span>
            {isSelected && (
              <span className="bg-brand/12 text-brand rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                {translations?.active ?? "Active"}
              </span>
            )}
          </div>
          {(info?.version || info?.cli_path) && (
            <p className="text-muted-foreground mt-0.5 truncate font-mono text-[11px]">
              {info?.version}
              {info?.version && info?.cli_path && " · "}
              {info?.cli_path}
            </p>
          )}
          {info?.error_message && (
            <p className="mt-0.5 truncate text-[11px] text-red-500">
              {info.error_message}
            </p>
          )}
        </div>

        {/* Status label */}
        <span
          className={cn(
            "shrink-0 text-xs font-medium",
            meta ? meta.text : "text-muted-foreground"
          )}
        >
          {statusLabel}
        </span>
      </div>

      {info?.status === "notinstalled" && (
        <div className="text-muted-foreground bg-[var(--surface-hover)] rounded-lg p-3 text-sm">
          {installInstructions}
        </div>
      )}
    </div>
  );
}
