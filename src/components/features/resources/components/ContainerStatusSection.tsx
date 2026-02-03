"use client";

import { AlertTriangle, Box, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ContainerInfo } from "@/lib/types";

interface ContainerStatusSectionProps {
  initContainers?: ContainerInfo[];
  containers: ContainerInfo[];
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function getExitCodeKey(code: number): { key: string; params?: Record<string, number> } {
  switch (code) {
    case 0:
      return { key: "podDetail.exitCodeSuccess" };
    case 1:
      return { key: "podDetail.exitCodeError" };
    case 137:
      return { key: "podDetail.exitCodeOomKilled" };
    case 143:
      return { key: "podDetail.exitCodeSigterm" };
    case 139:
      return { key: "podDetail.exitCodeSegfault" };
    case 126:
      return { key: "podDetail.exitCodePermissionDenied" };
    case 127:
      return { key: "podDetail.exitCodeCommandNotFound" };
    case 130:
      return { key: "podDetail.exitCodeSigint" };
    default:
      return code > 128
        ? { key: "podDetail.exitCodeSignal", params: { signal: code - 128 } }
        : { key: "podDetail.exitCodeGeneric", params: { code } };
  }
}

function StateIcon({ state }: { state: string }) {
  switch (state) {
    case "Running":
      return <CheckCircle2 className="size-4 text-green-500" />;
    case "Waiting":
      return <Clock className="size-4 text-yellow-500" />;
    case "Terminated":
      return <XCircle className="size-4 text-red-500" />;
    default:
      return <Box className="size-4 text-muted-foreground" />;
  }
}

function StateBadge({ state, reason }: { state: string; reason?: string | null }) {
  const displayText = reason ? `${state}: ${reason}` : state;

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-xs border-0",
        state === "Running" && "bg-green-500/10 text-green-500",
        state === "Waiting" && "bg-yellow-500/10 text-yellow-500",
        state === "Terminated" && "bg-destructive/10 text-destructive"
      )}
    >
      {displayText}
    </Badge>
  );
}

function ContainerCard({
  container,
  t,
}: {
  container: ContainerInfo;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StateIcon state={container.state} />
          <span className="font-medium">{container.name}</span>
          {!container.ready && container.state === "Running" && (
            <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
              {t("podDetail.notReady")}
            </Badge>
          )}
        </div>
        <StateBadge state={container.state} reason={container.state_reason} />
      </div>

      <div className="text-xs text-muted-foreground font-mono truncate">
        {container.image}
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{t("columns.restarts")}:</span>
          <span
            className={cn(
              "font-medium",
              container.restart_count > 10 && "text-red-500",
              container.restart_count > 0 && container.restart_count <= 10 && "text-yellow-500"
            )}
          >
            {container.restart_count}
          </span>
          {container.restart_count > 10 && (
            <AlertTriangle className="size-3.5 text-red-500" />
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{t("common.ready")}:</span>
          <span className={container.ready ? "text-green-500" : "text-red-500"}>
            {container.ready ? t("common.yes") : t("common.no")}
          </span>
        </div>
      </div>

      {container.last_state && container.restart_count > 0 && (
        <div className="mt-2 p-3 rounded-md bg-muted/50 border border-muted">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            {t("podDetail.lastTermination")}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {container.last_state_reason && (
              <div>
                <span className="text-muted-foreground">{t("common.reason")}: </span>
                <span className="font-medium text-red-400">
                  {container.last_state_reason}
                </span>
              </div>
            )}
            {container.last_exit_code !== null && (
              <div>
                <span className="text-muted-foreground">{t("podDetail.exitCode")}: </span>
                <span className="font-mono">
                  {container.last_exit_code} ({(() => {
                    const { key, params } = getExitCodeKey(container.last_exit_code);
                    return t(key, params);
                  })()})
                </span>
              </div>
            )}
            {container.last_finished_at && (
              <div className="col-span-2">
                <span className="text-muted-foreground">{t("podDetail.terminatedAt")}: </span>
                <span>{formatTimestamp(container.last_finished_at)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ContainerStatusSection({ initContainers, containers }: ContainerStatusSectionProps) {
  const t = useTranslations();

  const hasInitContainers = initContainers && initContainers.length > 0;
  const hasContainers = containers && containers.length > 0;

  if (!hasInitContainers && !hasContainers) {
    return null;
  }

  return (
    <section className="space-y-4">
      {hasInitContainers && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Box className="size-4" />
            {t("podDetail.initContainers")}
          </h3>
          <div className="space-y-3">
            {initContainers.map((container) => (
              <ContainerCard key={container.name} container={container} t={t} />
            ))}
          </div>
        </div>
      )}

      {hasContainers && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Box className="size-4" />
            {t("podDetail.containers")}
          </h3>
          <div className="space-y-3">
            {containers.map((container) => (
              <ContainerCard key={container.name} container={container} t={t} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
