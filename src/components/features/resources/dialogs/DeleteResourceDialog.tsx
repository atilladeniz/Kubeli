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
import { useTranslations } from "next-intl";

interface DeleteResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  resourceName: string;
  resourceType: string;
  namespace?: string;
}

export function DeleteResourceDialog({
  open,
  onOpenChange,
  onConfirm,
  resourceName,
  resourceType,
  namespace,
}: DeleteResourceDialogProps) {
  const t = useTranslations();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {resourceType === "helm-release"
              ? `Uninstall "${resourceName}"?`
              : t("messages.confirmDeleteTitle", { type: resourceType.charAt(0).toUpperCase() + resourceType.slice(1) })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("messages.confirmDelete", { name: resourceName })}
            {namespace && (
              <>
                {" "}
                ({t("cluster.namespace")}: <strong>{namespace}</strong>)
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {resourceType === "helm-release" ? "Uninstall" : t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
