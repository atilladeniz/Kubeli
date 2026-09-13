"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { usePlatform } from "@/lib/hooks/usePlatform";
import {
  DASHBOARD_SHORTCUTS,
  shortcutKeys,
  type DashboardShortcut,
} from "@/components/features/dashboard/shortcuts";

const GROUPS: DashboardShortcut["group"][] = ["navigation", "actions", "tabs"];

function KeyCombo({ keys, combo }: { keys: string[]; combo: boolean }) {
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

interface ShortcutsHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsHelpDialog({ open, onOpenChange }: ShortcutsHelpDialogProps) {
  const t = useTranslations("shortcuts");
  const tn = useTranslations("navigation");
  const { modKey } = usePlatform();

  const label = (s: DashboardShortcut) =>
    s.navKey ? `${t("goTo")} ${tn(s.navKey)}` : t(s.labelKey ?? s.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {GROUPS.map((group) => (
            <div key={group}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {t(group)}
              </h3>
              <div className="space-y-2">
                {DASHBOARD_SHORTCUTS.filter((s) => s.group === group && !s.helpHidden).map(
                  (shortcut) => (
                    <div key={shortcut.id} className="flex items-center justify-between">
                      <span className="text-sm">{label(shortcut)}</span>
                      <KeyCombo {...shortcutKeys(shortcut, modKey)} />
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
