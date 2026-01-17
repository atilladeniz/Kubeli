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

interface ShortcutItem {
  keys: string[];
  descriptionKey: string;
}

interface ShortcutGroup {
  titleKey: string;
  shortcuts: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    titleKey: "navigation",
    shortcuts: [
      { keys: ["g", "o"], descriptionKey: "goToOverview" },
      { keys: ["g", "r"], descriptionKey: "goToDiagram" },
      { keys: ["g", "p"], descriptionKey: "goToPods" },
      { keys: ["g", "d"], descriptionKey: "goToDeployments" },
      { keys: ["g", "s"], descriptionKey: "goToServices" },
      { keys: ["g", "n"], descriptionKey: "goToNodes" },
      { keys: ["g", "c"], descriptionKey: "goToConfigMaps" },
      { keys: ["g", "e"], descriptionKey: "goToSecrets" },
      { keys: ["g", "a"], descriptionKey: "goToNamespaces" },
    ],
  },
  {
    titleKey: "actions",
    shortcuts: [
      { keys: ["/"], descriptionKey: "focusSearch" },
      { keys: ["r"], descriptionKey: "refreshView" },
      { keys: ["?"], descriptionKey: "showHelp" },
      { keys: ["Esc"], descriptionKey: "closeEscape" },
    ],
  },
];

interface ShortcutsHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsHelpDialog({ open, onOpenChange }: ShortcutsHelpDialogProps) {
  const t = useTranslations("shortcuts");
  const tn = useTranslations("navigation");

  const getDescription = useMemo(() => (key: string) => {
    const descriptions: Record<string, string> = {
      goToOverview: `${t("goTo")} ${tn("overview")}`,
      goToDiagram: `${t("goTo")} ${tn("resourceDiagram")}`,
      goToPods: `${t("goTo")} ${tn("pods")}`,
      goToDeployments: `${t("goTo")} ${tn("deployments")}`,
      goToServices: `${t("goTo")} ${tn("services")}`,
      goToNodes: `${t("goTo")} ${tn("nodes")}`,
      goToConfigMaps: `${t("goTo")} ${tn("configMaps")}`,
      goToSecrets: `${t("goTo")} ${tn("secrets")}`,
      goToNamespaces: `${t("goTo")} ${tn("namespaces")}`,
      focusSearch: t("search"),
      refreshView: t("refresh"),
      showHelp: t("title"),
      closeEscape: t("escape"),
    };
    return descriptions[key] || key;
  }, [t, tn]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.titleKey}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {t(group.titleKey)}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.descriptionKey}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{getDescription(shortcut.descriptionKey)}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <Kbd>{key}</Kbd>
                          {i < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">→</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
