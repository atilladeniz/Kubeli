"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { PendingCloseState } from "../types";

interface CloseLogTabsDialogProps {
  pendingClose: PendingCloseState | null;
  dontAskAgain: boolean;
  closeLogTabLabel: string;
  closeLogTabDescriptionLabel: string;
  dontAskAgainLabel: string;
  cancelLabel: string;
  closeConfirmLabel: string;
  onOpenChange: (open: boolean) => void;
  onDontAskAgainChange: (checked: boolean) => void;
  onConfirm: () => void;
}

export function CloseLogTabsDialog({
  pendingClose,
  dontAskAgain,
  closeLogTabLabel,
  closeLogTabDescriptionLabel,
  dontAskAgainLabel,
  cancelLabel,
  closeConfirmLabel,
  onOpenChange,
  onDontAskAgainChange,
  onConfirm,
}: CloseLogTabsDialogProps) {
  return (
    <AlertDialog open={!!pendingClose} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{closeLogTabLabel}</AlertDialogTitle>
          <AlertDialogDescription>
            {closeLogTabDescriptionLabel}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-2 px-1">
          <Checkbox
            id="dont-ask-again"
            checked={dontAskAgain}
            onCheckedChange={(checked) => onDontAskAgainChange(checked === true)}
          />
          <Label
            htmlFor="dont-ask-again"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            {dontAskAgainLabel}
          </Label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{closeConfirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
