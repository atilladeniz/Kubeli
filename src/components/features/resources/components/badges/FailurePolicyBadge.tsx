"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { getStatusBadgeToneClass, type StatusBadgeTone } from "./statusBadgeStyles";

const policyTranslationKeys: Record<string, string> = {
  Fail: "common.fail",
  Ignore: "common.ignore",
};

const policyTones: Record<string, StatusBadgeTone> = {
  Fail: "danger",
  Ignore: "neutral",
};

export function FailurePolicyBadge({ policy }: { policy: string }) {
  const t = useTranslations();
  const translationKey = policyTranslationKeys[policy];
  const tone = policyTones[policy] || "neutral";

  return (
    <Badge
      variant="outline"
      className={cn("border font-medium", getStatusBadgeToneClass(tone))}
    >
      {translationKey ? t(translationKey) : policy}
    </Badge>
  );
}
