"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DNS_1123_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function validateNamespace(name: string): boolean {
  return DNS_1123_REGEX.test(name);
}

function parseNamespaces(input: string): string[] {
  return [
    ...new Set(
      input
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    ),
  ];
}

interface ConfigureNamespacesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: string;
  defaultNamespace?: string | null;
  existingNamespaces?: string[];
  onSave: (context: string, namespaces: string[]) => Promise<void>;
  onClear: (context: string) => Promise<void>;
}

export function ConfigureNamespacesDialog({
  open,
  onOpenChange,
  context,
  defaultNamespace,
  existingNamespaces,
  onSave,
  onClear,
}: ConfigureNamespacesDialogProps) {
  const t = useTranslations("cluster");
  const tCommon = useTranslations("common");
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Pre-fill textarea when dialog opens
  useEffect(() => {
    if (open) {
      if (existingNamespaces && existingNamespaces.length > 0) {
        setInput(existingNamespaces.join("\n"));
      } else {
        setInput("");
      }
    }
  }, [open, existingNamespaces, defaultNamespace]);

  const parsed = parseNamespaces(input);
  const invalidNames = parsed.filter((ns) => !validateNamespace(ns));

  const handleSave = useCallback(async () => {
    if (parsed.length === 0) return;
    setSaving(true);
    try {
      await onSave(context, parsed);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }, [parsed, context, onSave, onOpenChange]);

  const handleClear = useCallback(async () => {
    setSaving(true);
    try {
      await onClear(context);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }, [context, onClear, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("configureNamespaces")}</DialogTitle>
          <DialogDescription>
            {t("configureNamespacesDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <textarea
            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono cursor-text placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            placeholder={t("namespacesPlaceholder")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            data-1p-ignore
          />

          {invalidNames.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-yellow-600 dark:text-yellow-500">
              <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
              <div>
                <span>{t("invalidNamespaceWarning")}:</span>
                <span className="ml-1 font-mono">
                  {invalidNames.join(", ")}
                </span>
              </div>
            </div>
          )}

          {parsed.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {parsed.length} namespace{parsed.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        <DialogFooter>
          {existingNamespaces && existingNamespaces.length > 0 && (
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={saving}
              className="mr-auto"
            >
              {t("clearConfiguration")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || parsed.length === 0}
          >
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
