"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { BulkDeleteDialog } from "../dialogs/BulkDeleteDialog";
import type { BulkAction } from "../types";

interface BulkActionBarProps<T> {
  selectedCount: number;
  bulkActions: BulkAction<T>[];
  onAction: (action: BulkAction<T>) => void;
  onClearSelection: () => void;
}

export function BulkActionBar<T>({
  selectedCount,
  bulkActions,
  onAction,
  onClearSelection,
}: BulkActionBarProps<T>) {
  const t = useTranslations();
  const [pendingAction, setPendingAction] = useState<BulkAction<T> | null>(null);

  const handleActionClick = (action: BulkAction<T>) => {
    if (action.variant === "destructive") {
      setPendingAction(action);
    } else {
      onAction(action);
    }
  };

  const handleConfirm = () => {
    if (pendingAction) {
      onAction(pendingAction);
      setPendingAction(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-t border-border bg-background px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">
            {t("common.selected", { count: selectedCount })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-7 px-2"
          >
            <X className="size-3.5" />
            {t("logs.clear")}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {bulkActions.map((action) => (
            <Button
              key={action.key}
              variant={
                action.variant === "destructive" ? "destructive" : "outline"
              }
              size="sm"
              onClick={() => handleActionClick(action)}
              className="h-7"
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      <BulkDeleteDialog
        open={!!pendingAction}
        onOpenChange={(open) => !open && setPendingAction(null)}
        onConfirm={handleConfirm}
        count={selectedCount}
      />
    </>
  );
}
