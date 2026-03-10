"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, ArrowRightLeft } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PORT_MIN = 1024;
const PORT_MAX = 65535;

function ForwardPortContent() {
  const t = useTranslations("portForward");
  const tc = useTranslations("common");
  const { pendingForwardRequest, confirmForward, dismissForwardDialog, checkPort } =
    usePortForwardStore();
  const [localPortValue, setLocalPortValue] = useState("");
  const [portError, setPortError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validatePort = useCallback(
    async (port: number) => {
      const available = await checkPort(port);
      if (!available) {
        setPortError(t("portNotAvailable", { port }));
      } else {
        setPortError(null);
      }
      return available;
    },
    [checkPort, t]
  );

  const handleBlur = useCallback(() => {
    const port = parseInt(localPortValue, 10);
    if (localPortValue && !isNaN(port) && port >= PORT_MIN && port <= PORT_MAX) {
      validatePort(port);
    } else if (localPortValue && !isNaN(port)) {
      setPortError(t("portOutOfRange"));
    } else {
      setPortError(null);
    }
  }, [localPortValue, validatePort, t]);

  const handleForward = useCallback(async () => {
    const port = localPortValue ? parseInt(localPortValue, 10) : undefined;

    if (port !== undefined) {
      if (isNaN(port) || port < PORT_MIN || port > PORT_MAX) {
        setPortError(t("portOutOfRange"));
        return;
      }
      setIsSubmitting(true);
      const available = await validatePort(port);
      if (!available) {
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await confirmForward(port);
      // Reset local state only on success
      setLocalPortValue("");
      setPortError(null);
    } catch {
      setPortError(t("portNotAvailable", { port: localPortValue }));
    } finally {
      setIsSubmitting(false);
    }
  }, [localPortValue, confirmForward, validatePort, t]);

  const handleDismiss = useCallback(() => {
    setLocalPortValue("");
    setPortError(null);
    dismissForwardDialog();
  }, [dismissForwardDialog]);

  if (!pendingForwardRequest) return null;

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2">
          <ArrowRightLeft className="size-5" />
          {t("forwardPort")}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {t("forwardDialogDesc", {
            name: pendingForwardRequest.name,
            targetPort: pendingForwardRequest.targetPort,
            namespace: pendingForwardRequest.namespace,
          })}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="py-2 space-y-2">
        <Label htmlFor="local-port" className="text-sm">
          {t("customLocalPort")} <span className="text-muted-foreground font-normal">({tc("optional")})</span>
        </Label>
        <Input
          id="local-port"
          type="text"
          inputMode="numeric"
          placeholder={t("autoPortPlaceholder")}
          value={localPortValue}
          maxLength={5}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "").slice(0, 5);
            setLocalPortValue(val);
            setPortError(null);
          }}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleForward();
            }
          }}
          className={portError ? "border-red-500" : ""}
          autoComplete="off"
        />
        {portError && (
          <p className="text-xs text-red-500">{portError}</p>
        )}
      </div>

      <AlertDialogFooter>
        <Button variant="outline" onClick={handleDismiss} disabled={isSubmitting}>
          {tc("cancel")}
        </Button>
        <Button onClick={handleForward} disabled={isSubmitting || !!portError}>
          {t("forward")}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

function BrowserOpenContent() {
  const t = useTranslations("portForward");
  const { pendingBrowserOpen, confirmOpenBrowser, dismissBrowserDialog } =
    usePortForwardStore();
  const [rememberChoice, setRememberChoice] = useState(false);

  if (!pendingBrowserOpen) {
    return null;
  }

  return (
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
  );
}

export function BrowserOpenDialog() {
  const pendingForwardRequest = usePortForwardStore((s) => s.pendingForwardRequest);
  const pendingBrowserOpen = usePortForwardStore((s) => s.pendingBrowserOpen);

  const isOpen = !!pendingForwardRequest || !!pendingBrowserOpen;

  return (
    <AlertDialog open={isOpen}>
      {pendingForwardRequest ? <ForwardPortContent /> : <BrowserOpenContent />}
    </AlertDialog>
  );
}
