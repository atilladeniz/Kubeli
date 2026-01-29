import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useUIStore, type PortForwardBrowserBehavior } from "@/lib/stores/ui-store";
import { SettingSection } from "./SettingSection";

export function GeneralTab() {
  const t = useTranslations("settings");
  const { settings, updateSettings } = useUIStore();

  return (
    <div className="space-y-6">
      <SettingSection
        title={t("defaultNamespace.title")}
        description={t("defaultNamespace.description")}
      >
        <Input
          value={settings.defaultNamespace}
          onChange={(e) =>
            updateSettings({ defaultNamespace: e.target.value })
          }
          placeholder={t("defaultNamespace.placeholder")}
          className="w-48"
        />
      </SettingSection>

      <Separator />

      <SettingSection
        title={t("refreshInterval.title")}
        description={t("refreshInterval.description")}
      >
        <Select
          value={settings.refreshInterval.toString()}
          onValueChange={(value) =>
            updateSettings({ refreshInterval: parseInt(value) })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">{t("refreshInterval.seconds", { count: 5 })}</SelectItem>
            <SelectItem value="10">{t("refreshInterval.seconds", { count: 10 })}</SelectItem>
            <SelectItem value="30">{t("refreshInterval.seconds", { count: 30 })}</SelectItem>
            <SelectItem value="60">{t("refreshInterval.minute")}</SelectItem>
            <SelectItem value="300">{t("refreshInterval.minutes", { count: 5 })}</SelectItem>
          </SelectContent>
        </Select>
      </SettingSection>

      <Separator />

      <SettingSection
        title={t("portForwardBrowser.title")}
        description={t("portForwardBrowser.description")}
      >
        <Select
          value={settings.portForwardOpenBrowser || "ask"}
          onValueChange={(value) =>
            updateSettings({
              portForwardOpenBrowser: value as PortForwardBrowserBehavior,
            })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder={t("portForwardBrowser.ask")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ask">{t("portForwardBrowser.ask")}</SelectItem>
            <SelectItem value="always">{t("portForwardBrowser.always")}</SelectItem>
            <SelectItem value="never">{t("portForwardBrowser.never")}</SelectItem>
          </SelectContent>
        </Select>
      </SettingSection>

      <Separator />

      <SettingSection
        title={t("autoInstallUpdates.title")}
        description={t("autoInstallUpdates.description")}
      >
        <Switch
          checked={settings.autoInstallUpdates}
          onCheckedChange={(checked) =>
            updateSettings({ autoInstallUpdates: checked })
          }
        />
      </SettingSection>
    </div>
  );
}
