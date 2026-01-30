"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { usePlatform } from "@/lib/hooks/usePlatform";

interface ShortcutItem {
  keys: string[];
  /** Whether keys are pressed simultaneously (e.g., Cmd+W) vs sequentially (e.g., g then p) */
  combo?: boolean;
  label: (t: (key: string) => string, tn: (key: string) => string) => string;
}

interface ShortcutGroup {
  titleKey: string;
  shortcuts: ShortcutItem[];
}

const goTo = (t: (k: string) => string, tn: (k: string) => string, navKey: string) =>
  `${t("goTo")} ${tn(navKey)}`;

function buildShortcutGroups(mod: string): ShortcutGroup[] {
  return [
    {
      titleKey: "navigation",
      shortcuts: [
        { keys: ["g", "o"], label: (t, tn) => goTo(t, tn, "overview") },
        { keys: ["g", "r"], label: (t, tn) => goTo(t, tn, "resourceDiagram") },
        { keys: ["g", "p"], label: (t, tn) => goTo(t, tn, "pods") },
        { keys: ["g", "d"], label: (t, tn) => goTo(t, tn, "deployments") },
        { keys: ["g", "s"], label: (t, tn) => goTo(t, tn, "services") },
        { keys: ["g", "n"], label: (t, tn) => goTo(t, tn, "nodes") },
        { keys: ["g", "c"], label: (t, tn) => goTo(t, tn, "configMaps") },
        { keys: ["g", "e"], label: (t, tn) => goTo(t, tn, "secrets") },
        { keys: ["g", "a"], label: (t, tn) => goTo(t, tn, "namespaces") },
      ],
    },
    {
      titleKey: "actions",
      shortcuts: [
        { keys: ["/"], label: (t) => t("search") },
        { keys: ["r"], label: (t) => t("refresh") },
        { keys: ["?"], label: (t) => t("title") },
        { keys: ["Esc"], label: (t) => t("escape") },
      ],
    },
    {
      titleKey: "tabs",
      shortcuts: [
        { keys: [mod, "T"], combo: true, label: (t) => t("newTab") },
        { keys: [mod, "W"], combo: true, label: (t) => t("closeTab") },
      ],
    },
  ];
}

function KeyCombo({ keys, combo }: { keys: string[]; combo?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {keys.map((key, i) => (
        <span key={i} className="flex items-center gap-1">
          <Kbd>{key}</Kbd>
          {i < keys.length - 1 && (
            <span className="text-muted-foreground text-xs">
              {combo ? "+" : "→"}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function ShortcutRow({ shortcut, t, tn }: {
  shortcut: ShortcutItem;
  t: (key: string) => string;
  tn: (key: string) => string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{shortcut.label(t, tn)}</span>
      <KeyCombo keys={shortcut.keys} combo={shortcut.combo} />
    </div>
  );
}

interface ShortcutsHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsHelpDialog({ open, onOpenChange }: ShortcutsHelpDialogProps) {
  const t = useTranslations("shortcuts");
  const tn = useTranslations("navigation");
  const { modKey } = usePlatform();

  const shortcutGroups = useMemo(() => buildShortcutGroups(modKey), [modKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.titleKey}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {t(group.titleKey)}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, i) => (
                  <ShortcutRow key={i} shortcut={shortcut} t={t} tn={tn} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
