import { useTranslations } from "next-intl";
import { RotateCcw, Bug, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useUIStore } from "@/lib/stores/ui-store";
import { useUpdater } from "@/lib/hooks/useUpdater";
import { SettingSection } from "./SettingSection";

interface AdvancedTabProps {
  appVersion: string;
}

export function AdvancedTab({ appVersion }: AdvancedTabProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { settings, updateSettings, resetSettings } = useUIStore();
  const { available, isDev, simulateUpdate, clearSimulation } = useUpdater();

  return (
    <div className="space-y-6">
      <SettingSection
        title={t("advanced.virtualScroll")}
        description={t("advanced.virtualScrollDescription")}
      >
        <Select
          value={settings.virtualScrollThreshold.toString()}
          onValueChange={(value) =>
            updateSettings({ virtualScrollThreshold: parseInt(value) })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">{tc("items", { count: 50 })}</SelectItem>
            <SelectItem value="100">{tc("items", { count: 100 })}</SelectItem>
            <SelectItem value="200">{tc("items", { count: 200 })}</SelectItem>
            <SelectItem value="500">{tc("items", { count: 500 })}</SelectItem>
          </SelectContent>
        </Select>
      </SettingSection>

      <Separator />

      <SettingSection
        title={t("advanced.resetSettings")}
        description={t("advanced.resetSettingsDescription")}
      >
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <RotateCcw className="size-4 mr-2" />
              {t("advanced.resetAll")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("advanced.resetConfirmTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("advanced.resetConfirmDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={resetSettings}>
                {t("advanced.resetAll")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingSection>

      <Separator />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {t("about.title")} {tc("version")}
        </span>
        <span className="font-mono">{appVersion}</span>
      </div>

      {/* DEV ONLY: Update Simulation */}
      {isDev && (
        <>
          <Separator />
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-yellow-500">
              <Bug className="size-4" />
              <span className="text-sm font-medium">
                {t("advanced.devMode")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("advanced.devModeDescription")}
            </p>
            <div className="flex items-center gap-2">
              {available ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => clearSimulation()}
                  className="text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10"
                >
                  <X className="size-4 mr-1" />
                  {t("advanced.clearSimulation")}
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => simulateUpdate("1.0.0")}
                    className="text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10"
                  >
                    {t("advanced.simulateVersion", { version: "1.0.0" })}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => simulateUpdate("2.0.0")}
                    className="text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/10"
                  >
                    {t("advanced.simulateVersion", { version: "2.0.0" })}
                  </Button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
