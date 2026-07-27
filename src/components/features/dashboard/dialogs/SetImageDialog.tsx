"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setContainerImage, type ImagePatchTarget } from "@/lib/tauri/commands";
import { getErrorMessage } from "@/lib/types/errors";
import { splitImageRef, joinImageRef } from "./image-ref";

/** A container the dialog can retarget */
export interface SetImageContainer {
  name: string;
  image: string;
  init: boolean;
}

export interface SetImageDialogState {
  open: boolean;
  resourceType: ImagePatchTarget;
  name: string;
  namespace: string;
  containers: SetImageContainer[];
  onSuccess?: () => void;
}

interface SetImageDialogProps {
  state: SetImageDialogState | null;
  onClose: () => void;
}

export function SetImageDialog({ state, onClose }: SetImageDialogProps) {
  const t = useTranslations();
  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [repository, setRepository] = useState("");
  const [tag, setTag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const current = useMemo(
    () => state?.containers.find((c) => c.name === selectedContainer),
    [state?.containers, selectedContainer]
  );

  // Reset to the first container whenever the dialog opens on a new workload
  useEffect(() => {
    if (!state?.open) return;
    const first = state.containers[0];
    queueMicrotask(() => {
      setSelectedContainer(first?.name ?? "");
      const parts = splitImageRef(first?.image ?? "");
      setRepository(parts.repository);
      setTag(parts.tag);
    });
  }, [state?.open, state?.name, state?.containers]);

  const selectContainer = (name: string) => {
    const container = state?.containers.find((c) => c.name === name);
    setSelectedContainer(name);
    const parts = splitImageRef(container?.image ?? "");
    setRepository(parts.repository);
    setTag(parts.tag);
  };

  const nextImage = joinImageRef(repository, tag);
  const unchanged = current ? nextImage === current.image : true;
  const canSubmit = !!selectedContainer && repository.trim() !== "" && !unchanged && !isSubmitting;

  const handleSubmit = async () => {
    if (!state || !canSubmit) return;
    setIsSubmitting(true);
    try {
      await setContainerImage(
        state.resourceType,
        state.name,
        state.namespace,
        selectedContainer,
        nextImage,
        current?.init ?? false
      );
      toast.success(t("workloads.setImage"), {
        description: `${selectedContainer} → ${nextImage}`,
      });
      state.onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(t("workloads.setImageFailed"), { description: getErrorMessage(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={state?.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("workloads.setImage")}</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <p className="text-sm text-muted-foreground">
            <strong>{state?.name}</strong> ({t("cluster.namespace")}:{" "}
            <strong>{state?.namespace}</strong>)
          </p>

          {/* Container picker — only meaningful with more than one */}
          {state && state.containers.length > 1 && (
            <div className="space-y-2">
              <Label>{t("podDetail.containers")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {state.containers.map((container) => (
                  <button
                    key={container.name}
                    type="button"
                    onClick={() => selectContainer(container.name)}
                    className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                      container.name === selectedContainer
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    {container.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {current && (
            <p className="text-xs text-muted-foreground font-mono break-all">
              {t("workloads.currentImage")}: {current.image}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="image-repository">{t("workloads.imageRepository")}</Label>
            <Input
              id="image-repository"
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              placeholder="nginx"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image-tag">{t("workloads.imageTag")}</Label>
            <Input
              id="image-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="1.25"
              className="font-mono text-sm"
            />
          </div>

          {!unchanged && repository.trim() !== "" && (
            <p className="text-xs text-muted-foreground font-mono break-all">
              → {nextImage}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {t("workloads.setImage")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
