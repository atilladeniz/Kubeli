"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getStatusBadgeToneClass, type StatusBadgeTone } from "./statusBadgeStyles";

const variants: Record<string, StatusBadgeTone> = {
  Running: "success",
  Pending: "warning",
  Succeeded: "info",
  Failed: "danger",
  Terminating: "neutral",
  Unknown: "neutral",
  CrashLoopBackOff: "danger",
  Error: "danger",
  ImagePullBackOff: "warning",
  ErrImagePull: "warning",
  CreateContainerConfigError: "danger",
  OOMKilled: "danger",
  PodInitializing: "warning",
};

const phaseTranslationKeys: Record<string, string> = {
  Running: "running",
  Pending: "pending",
  Succeeded: "succeeded",
  Failed: "failed",
  Unknown: "unknown",
  Terminating: "terminating",
};

function getVariant(phase: string): StatusBadgeTone {
  if (variants[phase]) return variants[phase];
  if (phase.startsWith("Init:")) return "warning";
  return variants.Unknown;
}

function translateKnownPhase(phase: string, t: (key: string) => string): string {
  const translationKey = phaseTranslationKeys[phase];
  return translationKey ? t(translationKey) : phase;
}

export function PodPhaseBadge({ phase }: { phase: string }) {
  const t = useTranslations("pods");
  const label = phase.startsWith("Init:")
    ? `Init:${translateKnownPhase(phase.slice(5), t)}`
    : translateKnownPhase(phase, t);

  return (
    <Badge
      variant="outline"
      className={cn("border font-medium", getStatusBadgeToneClass(getVariant(phase)))}
    >
      {label}
    </Badge>
  );
}
