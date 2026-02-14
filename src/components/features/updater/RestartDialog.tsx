"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useUpdater } from "@/lib/hooks/useUpdater";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function RestartDialog() {
  const t = useTranslations("updates");
  const { readyToRestart, update, restartNow, restartLater, isSimulated } = useUpdater();

  if (!readyToRestart) {
    return null;
  }

  return (
    <AlertDialog open={readyToRestart}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RefreshCw className="size-5" />
            {t("updateReady")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isSimulated ? (
              t("simulatedUpdateDesc")
            ) : (
              t("updateReadyDesc", { version: update?.version ?? "" })
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <Button variant="outline" onClick={restartLater}>
            {t("restartLater")}
          </Button>
          <Button onClick={restartNow}>
            {t("restartNow")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
