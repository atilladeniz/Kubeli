"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { uninstallHelmRelease } from "@/lib/tauri/commands";

export interface UninstallDialogState {
  open: boolean;
  name: string;
  namespace: string;
  onSuccess?: () => void;
}

interface UninstallHelmDialogProps {
  state: UninstallDialogState | null;
  onClose: () => void;
}

export function UninstallHelmDialog({ state, onClose }: UninstallHelmDialogProps) {
  const t = useTranslations();

  const handleUninstall = async () => {
    if (!state) return;
    try {
      await uninstallHelmRelease(state.name, state.namespace);
      toast.success("Release uninstalled", { description: state.name });
      state.onSuccess?.();
    } catch (e) {
      toast.error("Failed to uninstall", { description: String(e) });
    }
    onClose();
  };

  return (
    <AlertDialog open={state?.open} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Uninstall Helm Release?</AlertDialogTitle>
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
            onClick={handleUninstall}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Uninstall
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
