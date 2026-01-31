import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useUIStore, type LogCloseConfirmation } from "@/lib/stores/ui-store";
import { SettingSection } from "./SettingSection";

export function LogsTab() {
  const t = useTranslations("settings");
  const { settings, updateSettings } = useUIStore();

  return (
    <div className="space-y-6">
      <SettingSection
        title={t("logs.retention")}
        description={t("logs.retentionDescription")}
      >
        <Select
          value={settings.logRetentionLines.toString()}
          onValueChange={(value) =>
            updateSettings({ logRetentionLines: parseInt(value) })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1000">1,000</SelectItem>
            <SelectItem value="5000">5,000</SelectItem>
            <SelectItem value="10000">10,000</SelectItem>
            <SelectItem value="50000">50,000</SelectItem>
          </SelectContent>
        </Select>
      </SettingSection>

      <Separator />

      <SettingSection
        title={t("logs.showTimestamps")}
        description={t("logs.showTimestampsDescription")}
      >
        <Switch
          checked={settings.logShowTimestamps}
          onCheckedChange={(checked) =>
            updateSettings({ logShowTimestamps: checked })
          }
        />
      </SettingSection>

      <Separator />

      <SettingSection
        title={t("logs.fontSize")}
        description={t("logs.fontSizeDescription")}
      >
        <Select
          value={settings.editorFontSize.toString()}
          onValueChange={(value) =>
            updateSettings({ editorFontSize: parseInt(value) })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="11">11px</SelectItem>
            <SelectItem value="12">12px</SelectItem>
            <SelectItem value="13">13px</SelectItem>
            <SelectItem value="14">14px</SelectItem>
            <SelectItem value="15">15px</SelectItem>
            <SelectItem value="16">16px</SelectItem>
          </SelectContent>
        </Select>
      </SettingSection>

      <Separator />

      <SettingSection
        title={t("logs.wordWrap")}
        description={t("logs.wordWrapDescription")}
      >
        <Switch
          checked={settings.editorWordWrap}
          onCheckedChange={(checked) =>
            updateSettings({ editorWordWrap: checked })
          }
        />
      </SettingSection>

      <Separator />

      <SettingSection
        title={t("logs.closeConfirmation")}
        description={t("logs.closeConfirmationDescription")}
      >
        <Select
          value={settings.logCloseConfirmation || "ask"}
          onValueChange={(value) =>
            updateSettings({ logCloseConfirmation: value as LogCloseConfirmation })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ask">{t("logs.closeConfirmationAsk")}</SelectItem>
            <SelectItem value="never">{t("logs.closeConfirmationNever")}</SelectItem>
          </SelectContent>
        </Select>
      </SettingSection>
    </div>
  );
}
