import { useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useUIStore, type ProxyType } from "@/lib/stores/ui-store";
import { SettingSection } from "./SettingSection";

export function NetworkTab() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { settings, updateSettings } = useUIStore();

  return (
    <div className="space-y-6">
      <SettingSection
        title={t("proxy.title")}
        description={t("proxy.description")}
      >
        <Select
          value={settings.proxyType || "none"}
          onValueChange={(value) =>
            updateSettings({ proxyType: value as ProxyType })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("proxy.none")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("proxy.none")}</SelectItem>
            <SelectItem value="system">{t("proxy.system")}</SelectItem>
            <SelectItem value="http">{t("proxy.http")}</SelectItem>
            <SelectItem value="socks5">{t("proxy.socks5")}</SelectItem>
          </SelectContent>
        </Select>
      </SettingSection>

      {settings.proxyType !== "none" &&
        settings.proxyType !== "system" && (
          <>
            <Separator />

            <SettingSection
              title={t("proxy.host")}
              description={t("proxy.hostDescription")}
            >
              <Input
                value={settings.proxyHost}
                onChange={(e) =>
                  updateSettings({ proxyHost: e.target.value })
                }
                placeholder={t("proxy.hostPlaceholder")}
                className="w-48"
              />
            </SettingSection>

            <Separator />

            <SettingSection
              title={t("proxy.port")}
              description={t("proxy.portDescription")}
            >
              <Input
                type="number"
                value={settings.proxyPort}
                onChange={(e) =>
                  updateSettings({
                    proxyPort: parseInt(e.target.value) || 8080,
                  })
                }
                placeholder="8080"
                className="w-24"
              />
            </SettingSection>

            <Separator />

            <SettingSection
              title={t("proxy.username")}
              description={t("proxy.usernameDescription")}
            >
              <Input
                value={settings.proxyUsername}
                onChange={(e) =>
                  updateSettings({ proxyUsername: e.target.value })
                }
                placeholder={tc("optional")}
                className="w-40"
              />
            </SettingSection>

            <Separator />

            <SettingSection
              title={t("proxy.password")}
              description={t("proxy.passwordDescription")}
            >
              <Input
                type="password"
                value={settings.proxyPassword}
                onChange={(e) =>
                  updateSettings({ proxyPassword: e.target.value })
                }
                placeholder={tc("optional")}
                className="w-40"
              />
            </SettingSection>
          </>
        )}

      {settings.proxyType === "system" && (
        <>
          <Separator />
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
            <Globe className="size-4 inline-block mr-2" />
            {t("proxy.systemInfo")}
          </div>
        </>
      )}
    </div>
  );
}
