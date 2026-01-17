"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { usePortForwardStore } from "@/lib/stores/portforward-store";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function BrowserOpenDialog() {
  const t = useTranslations("portForward");
  const { pendingBrowserOpen, confirmOpenBrowser, dismissBrowserDialog } =
    usePortForwardStore();
  const [rememberChoice, setRememberChoice] = useState(false);

  if (!pendingBrowserOpen) {
    return null;
  }

  return (
    <AlertDialog open={!!pendingBrowserOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ExternalLink className="size-5" />
            {t("openInBrowser")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("browserDialogDesc", { port: pendingBrowserOpen.localPort })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center space-x-2 py-2">
          <Checkbox
            id="remember"
            checked={rememberChoice}
            onCheckedChange={(checked) => setRememberChoice(checked === true)}
          />
          <Label
            htmlFor="remember"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            {t("rememberChoice")}
          </Label>
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => dismissBrowserDialog(rememberChoice)}
          >
            {t("noThanks")}
          </Button>
          <Button onClick={() => confirmOpenBrowser(rememberChoice)}>
            {t("openBrowser")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
