"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scaleDeployment } from "@/lib/tauri/commands";

export interface ScaleDialogState {
  open: boolean;
  name: string;
  namespace: string;
  currentReplicas: number;
  onSuccess?: () => void;
}

interface ScaleDeploymentDialogProps {
  state: ScaleDialogState | null;
  onClose: () => void;
}

export function ScaleDeploymentDialog({ state, onClose }: ScaleDeploymentDialogProps) {
  const t = useTranslations();
  const [newReplicas, setNewReplicas] = useState<number>(1);
  const [scaleToZeroWarning, setScaleToZeroWarning] = useState(false);

  // Sync replicas when dialog opens
  useEffect(() => {
    if (state?.open) {
      queueMicrotask(() => setNewReplicas(state.currentReplicas));
    }
  }, [state?.open, state?.currentReplicas]);

  const executeScale = async () => {
    if (!state) return;
    try {
      await scaleDeployment(state.name, state.namespace, newReplicas);
      toast.success(t("workloads.scale"), {
        description: `${state.name} → ${newReplicas} ${t("workloads.replicas").toLowerCase()}`,
      });
      state.onSuccess?.();
      onClose();
      setScaleToZeroWarning(false);
    } catch (err) {
      toast.error(t("errors.loadFailed"), { description: String(err) });
    }
  };

  const handleScaleConfirm = async () => {
    if (!state) return;
    if (newReplicas === 0) {
      setScaleToZeroWarning(true);
      return;
    }
    await executeScale();
  };

  const handleClose = () => {
    setScaleToZeroWarning(false);
    onClose();
  };

  return (
    <>
      {/* Scale Deployment Dialog */}
      <Dialog open={state?.open} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("workloads.scale")} {t("navigation.deployments")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("workloads.scale")} <strong>{state?.name}</strong> ({t("cluster.namespace")}:{" "}
              <strong>{state?.namespace}</strong>)
            </p>
            <div className="space-y-2">
              <Label htmlFor="replicas">{t("workloads.replicas")}</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNewReplicas(Math.max(0, newReplicas - 1))}
                  disabled={newReplicas <= 0}
                >
                  <Minus className="size-4" />
                </Button>
                <Input
                  id="replicas"
                  type="number"
                  min={0}
                  value={newReplicas}
                  onChange={(e) => setNewReplicas(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <Button variant="outline" size="icon" onClick={() => setNewReplicas(newReplicas + 1)}>
                  <Plus className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {state?.currentReplicas} {t("workloads.replicas").toLowerCase()}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleScaleConfirm}>{t("workloads.scale")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scale to Zero Warning Dialog */}
      <AlertDialog open={scaleToZeroWarning} onOpenChange={setScaleToZeroWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workloads.scale")} → 0?</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workloads.scale")} <strong>{state?.name}</strong> → 0{" "}
              {t("workloads.replicas").toLowerCase()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setScaleToZeroWarning(false)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeScale}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("workloads.scale")} → 0
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
