import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  useUIStore,
  defaultSettings,
  type VibrancyLevel,
} from "@/lib/stores/ui-store";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { SettingSection } from "./SettingSection";
import { ThemeSelector } from "./ThemeSelector";

export function AppearanceTab() {
  const t = useTranslations("settings");
  const { settings, setTheme, setLocale, updateSettings } = useUIStore();

  const vibrancyLevel = useMemo((): VibrancyLevel => {
    const validLevels: VibrancyLevel[] = ["off", "standard", "more", "extra"];
    if (settings.vibrancyLevel && validLevels.includes(settings.vibrancyLevel)) {
      return settings.vibrancyLevel;
    }
    return defaultSettings.vibrancyLevel;
  }, [settings.vibrancyLevel]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-sm font-medium">{t("theme.title")}</Label>
        <ThemeSelector
          value={settings.theme}
          onChange={(theme) => setTheme(theme)}
        />
      </div>

      <Separator />

      <SettingSection
        title={t("language.title")}
        description={t("language.description")}
      >
        <Select
          value={settings.locale || "system"}
          onValueChange={(value) => setLocale(value as Locale)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("language.system")} />
          </SelectTrigger>
          <SelectContent>
            {locales.map((locale) => (
              <SelectItem key={locale} value={locale}>
                {localeNames[locale]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingSection>

      <Separator />

      <SettingSection
        title={t("windowBlur.title")}
        description={t("windowBlur.description")}
      >
        <Select
          value={vibrancyLevel}
          onValueChange={(value) =>
            updateSettings({ vibrancyLevel: value as VibrancyLevel })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue>
              {vibrancyLevel === "off" && t("windowBlur.off")}
              {vibrancyLevel === "standard" && t("windowBlur.standard")}
              {vibrancyLevel === "more" && t("windowBlur.more")}
              {vibrancyLevel === "extra" && t("windowBlur.extra")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">{t("windowBlur.off")}</SelectItem>
            <SelectItem value="standard">{t("windowBlur.standard")}</SelectItem>
            <SelectItem value="more">{t("windowBlur.more")}</SelectItem>
            <SelectItem value="extra">{t("windowBlur.extra")}</SelectItem>
          </SelectContent>
        </Select>
      </SettingSection>

      <Separator />

      <SettingSection
        title={t("animations.title")}
        description={t("animations.description")}
      >
        <Switch
          checked={settings.enableAnimations}
          onCheckedChange={(checked) =>
            updateSettings({ enableAnimations: checked })
          }
        />
      </SettingSection>
    </div>
  );
}
