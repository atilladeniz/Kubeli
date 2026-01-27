"use client";

import { useTranslations } from "next-intl";
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

export interface DeleteDialogState {
  open: boolean;
  resourceType: string;
  name: string;
  namespace?: string;
  onConfirm: () => void;
}

interface DeleteConfirmDialogProps {
  state: DeleteDialogState | null;
  onClose: () => void;
}

export function DeleteConfirmDialog({ state, onClose }: DeleteConfirmDialogProps) {
  const t = useTranslations();

  return (
    <AlertDialog open={state?.open} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("common.delete")} {state?.resourceType}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("messages.confirmDelete", { name: state?.name || "" })}
            {state?.namespace && (
              <>
                {" "}
                ({t("cluster.namespace")}: <strong>{state.namespace}</strong>)
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => state?.onConfirm()}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
