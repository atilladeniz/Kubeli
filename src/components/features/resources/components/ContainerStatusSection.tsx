"use client";

import { useState, useCallback } from "react";
import { AlertTriangle, Box, CheckCircle2, Check, ChevronDown, ChevronRight, Clock, Copy, Eye, EyeOff, Key, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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

function EnvVarSourceBadge({ kind }: { kind: string }) {
  const styles: Record<string, string> = {
    secret: "border-yellow-500/50 text-yellow-500",
    configMap: "border-blue-500/50 text-blue-500",
    field: "border-purple-500/50 text-purple-500",
    resource: "border-green-500/50 text-green-500",
  };
  return (
    <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-3.5 shrink-0", styles[kind])}>
      {kind}
    </Badge>
  );
}

function EnvVarRow({ env, t }: { env: ContainerInfo["env_vars"][number]; t: ReturnType<typeof useTranslations> }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const isRef = !!env.value_from_kind;
  const displayValue = env.value_from ?? env.value ?? "";

  const toggleReveal = useCallback(() => {
    if (revealed) {
      setRevealed(false);
    } else {
      setRevealed(true);
      // Auto-hide after 10 seconds (like secrets)
      setTimeout(() => setRevealed(false), 10000);
    }
  }, [revealed]);

  const copyValue = useCallback(async () => {
    await navigator.clipboard.writeText(displayValue);
    setCopied(true);
    toast.success(t("messages.copySuccess"));
    setTimeout(() => setCopied(false), 2000);
  }, [displayValue, t]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{env.name}</span>
          {isRef && <EnvVarSourceBadge kind={env.value_from_kind!} />}
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="sm" onClick={copyValue} className="h-6 w-6 p-0">
            {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
          </Button>
          {!isRef && (
            <Button variant="ghost" size="sm" onClick={toggleReveal} className="h-6 w-6 p-0">
              {revealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            </Button>
          )}
        </div>
      </div>
      <div
        className="bg-muted/50 rounded-lg px-2.5 py-1.5 text-xs font-mono cursor-pointer hover:bg-muted/70 transition-colors"
        onClick={isRef ? undefined : toggleReveal}
        style={isRef ? undefined : {
          filter: revealed ? "blur(0px)" : "blur(2px)",
          transition: "filter 300ms ease-in-out",
          borderRadius: "8px",
          userSelect: revealed ? "text" : "none",
        }}
      >
        <span className={cn("break-all", isRef && "text-blue-400 italic text-[11px]")}>
          {isRef ? displayValue : (revealed ? displayValue : "••••••••")}
        </span>
      </div>
    </div>
  );
}

function EnvVarsSection({
  envVars,
  t,
}: {
  envVars: ContainerInfo["env_vars"];
  t: ReturnType<typeof useTranslations>;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!envVars || envVars.length === 0) return null;

  return (
    <div className="mt-4">
      <Separator className="mb-4" />
      <div className="rounded-lg border border-muted bg-muted/30">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full text-left group px-3 py-2.5"
        >
          <Key className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
            {t("podDetail.environmentVariables")}
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {envVars.length}
          </Badge>
          <div className="flex-1" />
          {expanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="px-3 pb-3 space-y-2">
            {envVars.map((env) => (
              <EnvVarRow key={env.name} env={env} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
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

      <div className="flex items-center gap-4 text-xs">
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
            <AlertTriangle className="size-3 text-red-500" />
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

      <EnvVarsSection envVars={container.env_vars} t={t} />
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
