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
      toast.success("Release forgotten", {
        description: `${state.name} removed from Helm history. Deployed resources are still running.`,
      });
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
          <AlertDialogTitle>Forget Helm Release?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the Helm release records (secrets) for{" "}
            <strong>{state?.name}</strong>
            {state?.namespace && (
              <>
                {" "}
                ({t("cluster.namespace")}: <strong>{state.namespace}</strong>)
              </>
            )}
            , so Helm no longer tracks it. The deployed resources stay in the
            cluster - delete them individually if you want them gone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUninstall}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Forget release
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
