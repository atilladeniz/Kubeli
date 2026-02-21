"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAiCli, useMcpIdes } from "./hooks";
import {
  KubeconfigTab,
  AppearanceTab,
  GeneralTab,
  NetworkTab,
  McpTab,
  AiTab,
  LogsTab,
  AdvancedTab,
  AboutTab,
} from "./components";

export function SettingsPanel() {
  const t = useTranslations("settings");
  const { isSettingsOpen, setSettingsOpen, settingsInitialTab } = useUIStore();
  const [activeTab, setActiveTab] = useState("appearance");
  const [appVersion, setAppVersion] = useState<string>("0.1.0");

  const aiCli = useAiCli(isSettingsOpen);
  const mcp = useMcpIdes(isSettingsOpen);

  // Sync active tab when settings panel opens with a specific tab
  useEffect(() => {
    if (isSettingsOpen) {
      setActiveTab(settingsInitialTab);
    }
  }, [isSettingsOpen, settingsInitialTab]);

  useEffect(() => {
    const getVersion = async () => {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        const version = await getVersion();
        setAppVersion(version);
      } catch {
        // Not running in Tauri, use default version
      }
    };
    getVersion();
  }, []);

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] min-h-[45vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              {t("title")}
            </DialogTitle>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="shrink-0 w-full justify-start gap-1">
            <TabsTrigger value="appearance">{t("tabs.appearance")}</TabsTrigger>
            <TabsTrigger value="general">{t("tabs.general")}</TabsTrigger>
            <TabsTrigger value="network">{t("tabs.network")}</TabsTrigger>
            <TabsTrigger value="kubeconfig">{t("tabs.kubeconfig")}</TabsTrigger>
            <TabsTrigger value="mcp">{t("tabs.mcp")}</TabsTrigger>
            <TabsTrigger value="ai">{t("tabs.ai")}</TabsTrigger>
            <TabsTrigger value="logs">{t("tabs.logs")}</TabsTrigger>
            <TabsTrigger value="advanced">{t("tabs.advanced")}</TabsTrigger>
            <TabsTrigger value="about">{t("tabs.about")}</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4 px-1">
            <TabsContent value="appearance" className="m-0">
              <AppearanceTab />
            </TabsContent>

            <TabsContent value="general" className="m-0">
              <GeneralTab />
            </TabsContent>

            <TabsContent value="network" className="m-0">
              <NetworkTab />
            </TabsContent>

            <TabsContent value="kubeconfig" className="m-0">
              <KubeconfigTab />
            </TabsContent>

            <TabsContent value="mcp" className="m-0">
              <McpTab mcp={mcp} />
            </TabsContent>

            <TabsContent value="ai" className="m-0">
              <AiTab aiCli={aiCli} />
            </TabsContent>

            <TabsContent value="logs" className="m-0">
              <LogsTab />
            </TabsContent>

            <TabsContent value="advanced" className="m-0">
              <AdvancedTab appVersion={appVersion} />
            </TabsContent>

            <TabsContent value="about" className="m-0">
              <AboutTab appVersion={appVersion} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
