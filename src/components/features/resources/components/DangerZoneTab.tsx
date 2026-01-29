"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface DangerZoneTabProps {
  resourceName: string;
  resourceType: string;
  onDeleteClick: () => void;
}

export function DangerZoneTab({ resourceName, resourceType, onDeleteClick }: DangerZoneTabProps) {
  const t = useTranslations();

  return (
    <div className="p-4">
      <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div>
          <p className="text-sm font-medium">
            {resourceType === "helm-release"
              ? t("resourceDetail.uninstallResource", { name: resourceName })
              : t("resourceDetail.deleteResource", { type: resourceType.charAt(0).toUpperCase() + resourceType.slice(1), name: resourceName })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("resourceDetail.deleteWarning")}
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDeleteClick}
        >
          <Trash2 className="size-4" />
          {resourceType === "helm-release" ? "Uninstall" : t("common.delete")}
        </Button>
      </div>
    </div>
  );
}
