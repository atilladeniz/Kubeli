"use client";

import { useState } from "react";
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
import { restartDeployment } from "@/lib/tauri/commands";
import { getErrorMessage } from "@/lib/types/errors";

export interface RestartDialogState {
  open: boolean;
  resourceType: string;
  name: string;
  namespace: string;
  onSuccess?: () => void;
}

interface RestartDeploymentDialogProps {
  state: RestartDialogState | null;
  onClose: () => void;
}

export function RestartDeploymentDialog({ state, onClose }: RestartDeploymentDialogProps) {
  const t = useTranslations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!state) return;
    setIsSubmitting(true);
    try {
      await restartDeployment(state.name, state.namespace);
      toast.success(t("workloads.restarted"), { description: state.name });
      state.onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(t("workloads.restartFailed"), { description: getErrorMessage(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={state?.open} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("workloads.restart")} {state?.resourceType}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("workloads.restartConfirm", { name: state?.name || "" })}
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
            onClick={(e) => {
              // Keep the dialog open while the patch is in flight; we close it
              // ourselves once the restart succeeds.
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={isSubmitting}
          >
            {t("workloads.restart")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
