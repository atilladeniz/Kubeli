"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  RotateCcw,
  Heart,
  RefreshCw,
  Download,
  Bug,
  X,
  Globe,
  Bot,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plug,
  MessageSquare,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUpdater } from "@/lib/hooks/useUpdater";
import {
  aiCheckCliAvailable,
  aiCheckCodexCliAvailable,
  mcpDetectIdes,
  mcpInstallIde,
  mcpUninstallIde,
  mcpGetKubeliPath,
  type CliInfo,
  type CliStatus,
  type McpIdeInfo,
} from "@/lib/tauri/commands";
import Image from "next/image";
import {
  useUIStore,
  defaultSettings,
  type Theme,
  type VibrancyLevel,
  type PortForwardBrowserBehavior,
  type ProxyType,
  type AiCliProvider,
} from "@/lib/stores/ui-store";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";

export function SettingsPanel() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const {
    settings,
    isSettingsOpen,
    setSettingsOpen,
    setTheme,
    setLocale,
    updateSettings,
    resetSettings,
  } = useUIStore();
  const {
    checking,
    available,
    downloading,
    progress,
    error,
    update,
    checkForUpdates,
    downloadAndInstall,
    isDev,
    simulateUpdate,
    clearSimulation,
  } = useUpdater();

  const [appVersion, setAppVersion] = useState<string>("0.1.0");

  // Ensure vibrancyLevel always has a valid value (handles hydration)
  const vibrancyLevel = useMemo((): VibrancyLevel => {
    const validLevels: VibrancyLevel[] = ["off", "standard", "more", "extra"];
    if (settings.vibrancyLevel && validLevels.includes(settings.vibrancyLevel)) {
      return settings.vibrancyLevel;
    }
    return defaultSettings.vibrancyLevel;
  }, [settings.vibrancyLevel]);

  // AI Assistant state
  const [claudeCliInfo, setClaudeCliInfo] = useState<CliInfo | null>(null);
  const [codexCliInfo, setCodexCliInfo] = useState<CliInfo | null>(null);
  const [aiCheckingCli, setAiCheckingCli] = useState(false);

  // MCP Server state
  const [mcpIdes, setMcpIdes] = useState<McpIdeInfo[]>([]);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpKubeliPath, setMcpKubeliPath] = useState<string>("");
  const [mcpInstallingId, setMcpInstallingId] = useState<string | null>(null);
  const [mcpExamplesOpen, setMcpExamplesOpen] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  // Platform detection for OS-specific commands
  const [isWindows, setIsWindows] = useState(false);

  useEffect(() => {
    const detectPlatform = async () => {
      try {
        const { type } = await import("@tauri-apps/plugin-os");
        const osType = await type();
        setIsWindows(osType === "windows");
      } catch {
        // Platform detection failed, assume non-Windows
      }
    };
    detectPlatform();
  }, []);

  // Handler for check updates with toast feedback
  const handleCheckForUpdates = useCallback(async () => {
    await checkForUpdates(true);
  }, [checkForUpdates]);

  // Check both AI CLIs in parallel and auto-select best available
  const checkAiClis = useCallback(async () => {
    setAiCheckingCli(true);
    try {
      const [claudeInfo, codexInfo] = await Promise.all([
        aiCheckCliAvailable().catch((err) => ({
          status: "error" as CliStatus,
          version: null,
          cli_path: null,
          error_message: String(err),
        })),
        aiCheckCodexCliAvailable().catch((err) => ({
          status: "error" as CliStatus,
          version: null,
          cli_path: null,
          error_message: String(err),
        })),
      ]);
      setClaudeCliInfo(claudeInfo);
      setCodexCliInfo(codexInfo);

      // Auto-select provider only if current selection is not available
      const claudeAvailable = claudeInfo.status === "authenticated";
      const codexAvailable = codexInfo.status === "authenticated";
      const currentProvider = settings.aiCliProvider || "claude";

      // Only auto-switch if the currently selected provider is NOT available
      if (currentProvider === "claude" && !claudeAvailable && codexAvailable) {
        // User has Claude selected but it's not available, switch to Codex
        updateSettings({ aiCliProvider: "codex" });
      } else if (currentProvider === "codex" && !codexAvailable && claudeAvailable) {
        // User has Codex selected but it's not available, switch to Claude
        updateSettings({ aiCliProvider: "claude" });
      } else if (!settings.aiCliProvider) {
        // No provider set yet, pick the first available (Claude preferred)
        if (claudeAvailable) {
          updateSettings({ aiCliProvider: "claude" });
        } else if (codexAvailable) {
          updateSettings({ aiCliProvider: "codex" });
        }
      }
      // Otherwise keep user's selection
    } catch (err) {
      console.error("Failed to check AI CLIs:", err);
    } finally {
      setAiCheckingCli(false);
    }
  }, [settings.aiCliProvider, updateSettings]);

  // Get app version from Tauri
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

  // Check AI CLIs when settings open
  useEffect(() => {
    if (isSettingsOpen && !claudeCliInfo && !codexCliInfo && !aiCheckingCli) {
      checkAiClis();
    }
  }, [isSettingsOpen, claudeCliInfo, codexCliInfo, aiCheckingCli, checkAiClis]);

  // MCP IDE detection
  const checkMcpIdes = useCallback(async () => {
    setMcpLoading(true);
    try {
      const [ides, kubeliPath] = await Promise.all([
        mcpDetectIdes(),
        mcpGetKubeliPath(),
      ]);
      setMcpIdes(ides);
      setMcpKubeliPath(kubeliPath);
    } catch (err) {
      console.error("Failed to detect IDEs:", err);
    } finally {
      setMcpLoading(false);
    }
  }, []);

  // Check MCP IDEs when settings open
  useEffect(() => {
    if (isSettingsOpen && mcpIdes.length === 0 && !mcpLoading) {
      checkMcpIdes();
    }
  }, [isSettingsOpen, mcpIdes.length, mcpLoading, checkMcpIdes]);

  // MCP install/uninstall handlers
  const handleMcpInstall = useCallback(async (ideId: string, ideName: string) => {
    setMcpInstallingId(ideId);
    try {
      await mcpInstallIde(ideId);
      toast.success(t("mcp.installSuccess", { ide: ideName }));
      await checkMcpIdes();
    } catch (err) {
      console.error("Failed to install MCP:", err);
      toast.error(t("mcp.installError"));
    } finally {
      setMcpInstallingId(null);
    }
  }, [checkMcpIdes, t]);

  const handleMcpUninstall = useCallback(async (ideId: string, ideName: string) => {
    setMcpInstallingId(ideId);
    try {
      await mcpUninstallIde(ideId);
      toast.success(t("mcp.uninstallSuccess", { ide: ideName }));
      await checkMcpIdes();
    } catch (err) {
      console.error("Failed to uninstall MCP:", err);
      toast.error(t("mcp.uninstallError"));
    } finally {
      setMcpInstallingId(null);
    }
  }, [checkMcpIdes, t]);

  const handleCopyPrompt = useCallback(async (prompt: string, key: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(key);
      setTimeout(() => setCopiedPrompt(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  // Example prompts organized by category
  const examplePrompts = useMemo(() => [
    {
      category: t("mcp.promptCategories.pods"),
      prompts: [
        { key: "listPods", text: t("mcp.prompts.listPods") },
        { key: "listPodsNs", text: t("mcp.prompts.listPodsNs") },
        { key: "podStatus", text: t("mcp.prompts.podStatus") },
      ],
    },
    {
      category: t("mcp.promptCategories.deployments"),
      prompts: [
        { key: "listDeployments", text: t("mcp.prompts.listDeployments") },
        { key: "deploymentStatus", text: t("mcp.prompts.deploymentStatus") },
        { key: "scaleDeployment", text: t("mcp.prompts.scaleDeployment") },
      ],
    },
    {
      category: t("mcp.promptCategories.services"),
      prompts: [
        { key: "listServices", text: t("mcp.prompts.listServices") },
        { key: "serviceDetails", text: t("mcp.prompts.serviceDetails") },
      ],
    },
    {
      category: t("mcp.promptCategories.logs"),
      prompts: [
        { key: "getLogs", text: t("mcp.prompts.getLogs") },
        { key: "getLogsLines", text: t("mcp.prompts.getLogsLines") },
      ],
    },
    {
      category: t("mcp.promptCategories.general"),
      prompts: [
        { key: "clusterInfo", text: t("mcp.prompts.clusterInfo") },
        { key: "namespaces", text: t("mcp.prompts.namespaces") },
        { key: "events", text: t("mcp.prompts.events") },
        { key: "podYaml", text: t("mcp.prompts.podYaml") },
        { key: "troubleshoot", text: t("mcp.prompts.troubleshoot") },
      ],
    },
  ], [t]);

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              {t("title")}
            </DialogTitle>
          </div>
        </DialogHeader>

        <Tabs
          defaultValue="appearance"
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="shrink-0 w-full justify-start gap-1">
            <TabsTrigger value="appearance">{t("tabs.appearance")}</TabsTrigger>
            <TabsTrigger value="general">{t("tabs.general")}</TabsTrigger>
            <TabsTrigger value="network">{t("tabs.network")}</TabsTrigger>
            <TabsTrigger value="mcp">{t("tabs.mcp")}</TabsTrigger>
            <TabsTrigger value="ai">{t("tabs.ai")}</TabsTrigger>
            <TabsTrigger value="logs">{t("tabs.logs")}</TabsTrigger>
            <TabsTrigger value="advanced">{t("tabs.advanced")}</TabsTrigger>
            <TabsTrigger value="about">{t("tabs.about")}</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4 px-1">
            {/* Appearance Tab */}
            <TabsContent value="appearance" className="m-0 space-y-6">
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
            </TabsContent>

            {/* General Tab */}
            <TabsContent value="general" className="m-0 space-y-6">
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
                      portForwardOpenBrowser:
                        value as PortForwardBrowserBehavior,
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
            </TabsContent>

            {/* Network Tab */}
            <TabsContent value="network" className="m-0 space-y-6">
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
            </TabsContent>

            {/* MCP Tab */}
            <TabsContent value="mcp" className="m-0 space-y-6">
              {/* Header with Refresh */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{t("mcp.ideIntegration")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("mcp.ideIntegrationDescription")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkMcpIdes}
                  disabled={mcpLoading}
                >
                  {mcpLoading ? (
                    <>
                      <RefreshCw className="size-4 mr-2 animate-spin" />
                      {t("about.checking")}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-4 mr-2" />
                      {t("mcp.refreshIdes")}
                    </>
                  )}
                </Button>
              </div>

              {/* IDE Cards */}
              <div className="space-y-3">
                {mcpIdes.map((ide) => (
                  <McpIdeCard
                    key={ide.id}
                    ide={ide}
                    isInstalling={mcpInstallingId === ide.id}
                    onInstall={() => handleMcpInstall(ide.id, ide.name)}
                    onUninstall={() => handleMcpUninstall(ide.id, ide.name)}
                    translations={{
                      installed: t("mcp.installed"),
                      notInstalled: t("mcp.notInstalled"),
                      notDetected: t("mcp.notDetected"),
                      install: t("mcp.install"),
                      uninstall: t("mcp.uninstall"),
                      installing: t("mcp.installing"),
                    }}
                  />
                ))}
                {mcpIdes.length === 0 && !mcpLoading && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    {t("about.checking")}
                  </div>
                )}
              </div>

              <Separator />

              {/* Kubeli Path */}
              <div className="space-y-2">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{t("mcp.kubeliPath")}</Label>
                  <p className="text-xs text-muted-foreground">{t("mcp.kubeliPathDescription")}</p>
                </div>
                <code className="block text-xs font-mono bg-muted px-3 py-2 rounded-md text-muted-foreground break-all">
                  {mcpKubeliPath || "..."}
                </code>
              </div>

              <Separator />

              {/* How It Works Info */}
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Plug className="size-4" />
                  <span className="font-medium">{t("mcp.howItWorks")}</span>
                </div>
                <p className="text-xs">
                  {t("mcp.howItWorksDescription")}
                </p>
                <p className="text-xs font-medium text-foreground mt-2">
                  {t("mcp.capabilities")}
                </p>
                <ul className="text-xs space-y-1 ml-6 list-disc">
                  <li>{t("mcp.capabilityPods")}</li>
                  <li>{t("mcp.capabilityDeployments")}</li>
                  <li>{t("mcp.capabilityServices")}</li>
                  <li>{t("mcp.capabilityLogs")}</li>
                  <li>{t("mcp.capabilityEvents")}</li>
                  <li>{t("mcp.capabilityYaml")}</li>
                </ul>
              </div>

              <Separator />

              {/* Example Prompts Button */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{t("mcp.examplePrompts")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("mcp.examplePromptsDescription")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMcpExamplesOpen(true)}
                >
                  <MessageSquare className="size-4 mr-2" />
                  {t("mcp.showExamples")}
                </Button>
              </div>

              {/* Example Prompts Dialog */}
              <Dialog open={mcpExamplesOpen} onOpenChange={setMcpExamplesOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[70vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle>{t("mcp.examplePrompts")}</DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-auto space-y-4 pr-2">
                    {examplePrompts.map((category) => (
                      <div key={category.category} className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">
                          {category.category}
                        </h4>
                        <div className="space-y-1">
                          {category.prompts.map((prompt) => (
                            <div
                              key={prompt.key}
                              className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors group"
                            >
                              <code className="text-xs flex-1">{prompt.text}</code>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
                                onClick={() => handleCopyPrompt(prompt.text, prompt.key)}
                              >
                                {copiedPrompt === prompt.key ? (
                                  <>
                                    <Check className="size-3 mr-1 text-green-500" />
                                    <span className="text-xs text-green-500">{t("mcp.copied")}</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="size-3 mr-1" />
                                    <span className="text-xs">{t("mcp.copyPrompt")}</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* AI Tab */}
            <TabsContent value="ai" className="m-0 space-y-6">
              {/* AI CLI Provider Selector */}
              <SettingSection
                title={t("ai.title")}
                description={t("ai.description")}
              >
                <Select
                  value={settings.aiCliProvider || "claude"}
                  onValueChange={(value) =>
                    updateSettings({ aiCliProvider: value as AiCliProvider })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t("ai.claudeCode")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude">{t("ai.claudeCode")}</SelectItem>
                    <SelectItem value="codex">{t("ai.codex")}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingSection>

              <Separator />

              {/* CLI Status Header with Refresh */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{t("ai.cliStatus")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("ai.cliStatusDescription")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkAiClis}
                  disabled={aiCheckingCli}
                >
                  {aiCheckingCli ? (
                    <>
                      <RefreshCw className="size-4 mr-2 animate-spin" />
                      {t("about.checking")}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-4 mr-2" />
                      {tc("refresh")}
                    </>
                  )}
                </Button>
              </div>

              {/* Claude CLI Status */}
              <CliStatusCard
                name={t("ai.claudeCode")}
                info={claudeCliInfo}
                isChecking={aiCheckingCli}
                isSelected={(settings.aiCliProvider || "claude") === "claude"}
                installInstructions={
                  <div className="space-y-3">
                    <p className="font-medium">{t("ai.installClaude")}</p>
                    {isWindows ? (
                      <>
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground/80">
                            {t("ai.installClaudeNative")} (PowerShell)
                          </p>
                          <code className="block bg-background rounded px-2 py-1 text-xs font-mono">
                            irm https://claude.ai/install.ps1 | iex
                          </code>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground/80">
                            {t("ai.installClaudeWinget")}
                          </p>
                          <code className="block bg-background rounded px-2 py-1 text-xs font-mono">
                            winget install Anthropic.ClaudeCode
                          </code>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground/80">
                            {t("ai.installClaudeNative")}
                          </p>
                          <code className="block bg-background rounded px-2 py-1 text-xs font-mono">
                            curl -fsSL https://claude.ai/install.sh | bash
                          </code>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground/80">
                            {t("ai.installClaudeBrew")}
                          </p>
                          <code className="block bg-background rounded px-2 py-1 text-xs font-mono">
                            brew install --cask claude-code
                          </code>
                        </div>
                      </>
                    )}
                    <p className="text-xs">
                      {t("ai.installClaudeAuth")}
                    </p>
                  </div>
                }
                translations={{
                  authenticated: t("ai.authenticated"),
                  notAuthenticated: t("ai.notAuthenticated"),
                  notInstalled: t("ai.notInstalled"),
                  checking: t("ai.checking"),
                  clickRefresh: t("ai.clickRefresh"),
                  active: t("ai.active"),
                }}
              />

              {/* Codex CLI Status */}
              <CliStatusCard
                name={t("ai.codex")}
                info={codexCliInfo}
                isChecking={aiCheckingCli}
                isSelected={settings.aiCliProvider === "codex"}
                installInstructions={
                  <div className="space-y-3">
                    <p className="font-medium">{t("ai.installCodex")}</p>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground/80">
                        {t("ai.installCodexNpm")}
                      </p>
                      <code className="block bg-background rounded px-2 py-1 text-xs font-mono">
                        npm i -g @openai/codex
                      </code>
                    </div>
                    {!isWindows && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground/80">
                          {t("ai.installCodexBrew")}
                        </p>
                        <code className="block bg-background rounded px-2 py-1 text-xs font-mono">
                          brew install codex
                        </code>
                      </div>
                    )}
                    <p className="text-xs">
                      {t("ai.installCodexAuth")}
                    </p>
                  </div>
                }
                translations={{
                  authenticated: t("ai.authenticated"),
                  notAuthenticated: t("ai.notAuthenticated"),
                  notInstalled: t("ai.notInstalled"),
                  checking: t("ai.checking"),
                  clickRefresh: t("ai.clickRefresh"),
                  active: t("ai.active"),
                }}
              />

              <Separator />

              {/* AI Feature Info */}
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Bot className="size-4" />
                  <span className="font-medium">{t("ai.howItWorks")}</span>
                </div>
                <p className="text-xs">
                  {t("ai.howItWorksDescription")}
                </p>
                <p className="text-xs font-medium text-foreground mt-2">
                  {t("ai.aiCanHelp")}
                </p>
                <ul className="text-xs space-y-1 ml-6 list-disc">
                  <li>{t("ai.helpAnalyze")}</li>
                  <li>{t("ai.helpLogs")}</li>
                  <li>{t("ai.helpHealth")}</li>
                  <li>{t("ai.helpExplain")}</li>
                </ul>
              </div>
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="m-0 space-y-6">
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
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="m-0 space-y-6">
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
                  <SelectTrigger className="w-32">
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
                      <AlertDialogTitle>{t("advanced.resetConfirmTitle")}</AlertDialogTitle>
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
                <span>{t("about.title")} {tc("version")}</span>
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
            </TabsContent>

            {/* About Tab */}
            <TabsContent value="about" className="m-0">
              <div className="flex flex-col items-center text-center py-4">
                <div className="mb-4 rounded-2xl bg-muted p-4">
                  <Image
                    src="/kubeli-icon.png"
                    alt="Kubeli"
                    width={80}
                    height={80}
                    className="rounded-xl"
                  />
                </div>
                <h2 className="text-2xl font-bold mb-1">{t("about.title")}</h2>
                <p className="text-sm text-muted-foreground mb-2">
                  {tc("version")} {appVersion}
                </p>

                {/* Update Check Section */}
                <div className="mb-4 space-y-2">
                  {downloading ? (
                    <div className="space-y-2">
                      <Button size="sm" disabled>
                        <RefreshCw className="size-4 mr-2 animate-spin" />
                        {t("about.downloading", { progress: Math.round(progress) })}
                      </Button>
                      <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  ) : available && update ? (
                    <Button size="sm" onClick={() => downloadAndInstall()}>
                      <Download className="size-4 mr-2" />
                      {t("about.updateTo", { version: update.version })}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCheckForUpdates}
                      disabled={checking}
                    >
                      {checking ? (
                        <>
                          <RefreshCw className="size-4 mr-2 animate-spin" />
                          {t("about.checking")}
                        </>
                      ) : (
                        <>
                          <RefreshCw className="size-4 mr-2" />
                          {t("about.checkForUpdates")}
                        </>
                      )}
                    </Button>
                  )}
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>

                <div className="max-w-md space-y-4 text-sm text-muted-foreground">
                  <p>
                    <span className="text-foreground font-medium">
                      {t("about.thankYou")}
                    </span>
                  </p>
                  <p>
                    {t("about.description")}
                  </p>
                  <p>
                    {t("about.devNote")}
                  </p>
                  <p className="flex items-center justify-center gap-1.5">
                    {t("about.happyOrchestrating")}{" "}
                    <Heart className="size-4 text-red-500 fill-red-500" />
                  </p>
                </div>

                <Separator className="my-6 w-full" />

                <div className="text-xs text-muted-foreground/70 space-y-2">
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">{t("about.developer")}</p>
                    <p className="font-medium text-foreground">Atilla Deniz</p>
                    <a
                      href="https://atilladeniz.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      atilladeniz.com
                    </a>
                  </div>
                  <p className="pt-1">
                    {t("about.tagline")}
                  </p>
                  <p>© {new Date().getFullYear()} Kubeli</p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

interface SettingSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingSection({ title, description, children }: SettingSectionProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

interface ThemeSelectorProps {
  value: Theme;
  onChange: (theme: Theme) => void;
}

function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const t = useTranslations("settings");

  return (
    <div className="grid grid-cols-4 gap-3 p-1">
      {/* Light Mode */}
      <button
        onClick={() => onChange("light")}
        className={cn("flex flex-col items-center gap-2 group")}
      >
        <div
          className={cn(
            "w-full aspect-[4/3] rounded-lg border-2 overflow-hidden transition-all",
            value === "light"
              ? "border-primary ring-2 ring-primary/20"
              : "border-border hover:border-muted-foreground/50"
          )}
        >
          {/* Light theme preview */}
          <div className="h-full bg-[#f5f5f5] p-2 flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <div className="size-1.5 rounded-full bg-gray-300" />
              <div className="h-1.5 w-8 rounded-full bg-gray-300" />
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-300" />
            <div className="h-1.5 w-3/4 rounded-full bg-gray-300" />
            <div className="mt-auto h-1.5 w-6 rounded-full bg-primary" />
          </div>
        </div>
        <span
          className={cn(
            "text-xs font-medium transition-colors",
            value === "light"
              ? "text-foreground"
              : "text-muted-foreground group-hover:text-foreground"
          )}
        >
          {t("theme.light")}
        </span>
      </button>

      {/* Dark Mode */}
      <button
        onClick={() => onChange("dark")}
        className={cn("flex flex-col items-center gap-2 group")}
      >
        <div
          className={cn(
            "w-full aspect-[4/3] rounded-lg border-2 overflow-hidden transition-all",
            value === "dark"
              ? "border-primary ring-2 ring-primary/20"
              : "border-border hover:border-muted-foreground/50"
          )}
        >
          {/* Dark theme preview */}
          <div className="h-full bg-[#1f1f1f] p-2 flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <div className="size-1.5 rounded-full bg-gray-600" />
              <div className="h-1.5 w-8 rounded-full bg-gray-600" />
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-600" />
            <div className="h-1.5 w-3/4 rounded-full bg-gray-600" />
            <div className="mt-auto h-1.5 w-6 rounded-full bg-primary" />
          </div>
        </div>
        <span
          className={cn(
            "text-xs font-medium transition-colors",
            value === "dark"
              ? "text-foreground"
              : "text-muted-foreground group-hover:text-foreground"
          )}
        >
          {t("theme.dark")}
        </span>
      </button>

      {/* Classic Dark Mode */}
      <button
        onClick={() => onChange("classic-dark")}
        className={cn("flex flex-col items-center gap-2 group")}
      >
        <div
          className={cn(
            "w-full aspect-[4/3] rounded-lg border-2 overflow-hidden transition-all",
            value === "classic-dark"
              ? "border-primary ring-2 ring-primary/20"
              : "border-border hover:border-muted-foreground/50"
          )}
        >
          {/* Classic dark theme preview */}
          <div className="h-full bg-[#191a22] p-2 flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <div className="size-1.5 rounded-full bg-gray-600" />
              <div className="h-1.5 w-8 rounded-full bg-gray-600" />
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-600" />
            <div className="h-1.5 w-3/4 rounded-full bg-gray-600" />
            <div className="mt-auto h-1.5 w-6 rounded-full bg-indigo-500" />
          </div>
        </div>
        <span
          className={cn(
            "text-xs font-medium transition-colors",
            value === "classic-dark"
              ? "text-foreground"
              : "text-muted-foreground group-hover:text-foreground"
          )}
        >
          {t("theme.classic")}
        </span>
      </button>

      {/* System/Auto Mode */}
      <button
        onClick={() => onChange("system")}
        className={cn("flex flex-col items-center gap-2 group")}
      >
        <div
          className={cn(
            "w-full aspect-[4/3] rounded-lg border-2 overflow-hidden transition-all",
            value === "system"
              ? "border-primary ring-2 ring-primary/20"
              : "border-border hover:border-muted-foreground/50"
          )}
        >
          {/* System/Auto theme preview - split view */}
          <div className="h-full flex">
            <div className="w-1/2 bg-[#f5f5f5] p-1.5 flex flex-col gap-1">
              <div className="h-1 w-full rounded-full bg-gray-300" />
              <div className="h-1 w-3/4 rounded-full bg-gray-300" />
              <div className="mt-auto h-1 w-4 rounded-full bg-primary" />
            </div>
            <div className="w-1/2 bg-[#1f1f1f] p-1.5 flex flex-col gap-1">
              <div className="h-1 w-full rounded-full bg-gray-600" />
              <div className="h-1 w-3/4 rounded-full bg-gray-600" />
              <div className="mt-auto h-1 w-4 rounded-full bg-primary" />
            </div>
          </div>
        </div>
        <span
          className={cn(
            "text-xs font-medium transition-colors",
            value === "system"
              ? "text-foreground"
              : "text-muted-foreground group-hover:text-foreground"
          )}
        >
          {t("theme.system")}
        </span>
      </button>
    </div>
  );
}

interface CliStatusCardTranslations {
  authenticated: string;
  notAuthenticated: string;
  notInstalled: string;
  checking: string;
  clickRefresh: string;
  active: string;
}

interface CliStatusCardProps {
  name: string;
  info: CliInfo | null;
  isChecking: boolean;
  isSelected: boolean;
  installInstructions: React.ReactNode;
  translations?: CliStatusCardTranslations;
}

function CliStatusCard({
  name,
  info,
  isChecking,
  isSelected,
  installInstructions,
  translations,
}: CliStatusCardProps) {
  const tc = useTranslations("common");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">{name}</Label>
        {isSelected && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {translations?.active || "Active"}
          </span>
        )}
      </div>

      {/* CLI Status Display */}
      <div
        className={cn(
          "rounded-lg border p-4 space-y-2",
          info?.status === "authenticated" &&
            "border-green-500/30 bg-green-500/5",
          info?.status === "notauthenticated" &&
            "border-yellow-500/30 bg-yellow-500/5",
          info?.status === "notinstalled" && "border-red-500/30 bg-red-500/5",
          info?.status === "error" && "border-red-500/30 bg-red-500/5",
          !info && "border-muted"
        )}
      >
        <div className="flex items-center gap-2">
          {info?.status === "authenticated" && (
            <>
              <CheckCircle className="size-5 text-green-500" />
              <span className="text-sm font-medium text-green-500">
                {translations?.authenticated || "Authenticated"}
              </span>
            </>
          )}
          {info?.status === "notauthenticated" && (
            <>
              <AlertCircle className="size-5 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-500">
                {translations?.notAuthenticated || "Not Authenticated"}
              </span>
            </>
          )}
          {info?.status === "notinstalled" && (
            <>
              <XCircle className="size-5 text-red-500" />
              <span className="text-sm font-medium text-red-500">
                {translations?.notInstalled || "Not Installed"}
              </span>
            </>
          )}
          {info?.status === "error" && (
            <>
              <XCircle className="size-5 text-red-500" />
              <span className="text-sm font-medium text-red-500">{tc("error")}</span>
            </>
          )}
          {!info && !isChecking && (
            <span className="text-sm text-muted-foreground">
              {translations?.clickRefresh || "Click Refresh to check status"}
            </span>
          )}
          {!info && isChecking && (
            <span className="text-sm text-muted-foreground">
              {translations?.checking || "Checking CLI status..."}
            </span>
          )}
        </div>

        {info?.version && (
          <div className="text-xs text-muted-foreground">
            {tc("version")}: <span className="font-mono">{info.version}</span>
          </div>
        )}
        {info?.cli_path && (
          <div className="text-xs text-muted-foreground">
            Path: <span className="font-mono">{info.cli_path}</span>
          </div>
        )}
        {info?.error_message && (
          <div className="text-xs text-red-500">{info.error_message}</div>
        )}
      </div>

      {/* Installation Instructions */}
      {info?.status === "notinstalled" && (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
          {installInstructions}
        </div>
      )}
    </div>
  );
}

interface McpIdeCardTranslations {
  installed: string;
  notInstalled: string;
  notDetected: string;
  install: string;
  uninstall: string;
  installing: string;
}

interface McpIdeCardProps {
  ide: McpIdeInfo;
  isInstalling: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  translations: McpIdeCardTranslations;
}

function McpIdeCard({
  ide,
  isInstalling,
  onInstall,
  onUninstall,
  translations,
}: McpIdeCardProps) {
  // IDE icons mapping
  const getIdeIcon = (ideId: string) => {
    switch (ideId) {
      case "claude_code":
        return "C";
      case "codex":
        return "O";
      case "vscode":
        return "VS";
      case "cursor":
        return "Cu";
      default:
        return "?";
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 flex items-center justify-between",
        ide.installed && ide.mcp_configured && "border-green-500/30 bg-green-500/5",
        ide.installed && !ide.mcp_configured && "border-muted",
        !ide.installed && "border-muted bg-muted/30"
      )}
    >
      <div className="flex items-center gap-3">
        {/* IDE Icon */}
        <div
          className={cn(
            "size-10 rounded-lg flex items-center justify-center text-sm font-bold",
            ide.installed
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {getIdeIcon(ide.id)}
        </div>

        {/* IDE Info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{ide.name}</span>
            {ide.mcp_configured && (
              <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">
                <CheckCircle className="size-3" />
                {translations.installed}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {ide.installed
              ? ide.mcp_configured
                ? ide.config_path
                : translations.notInstalled
              : translations.notDetected}
          </p>
        </div>
      </div>

      {/* Actions */}
      {ide.installed && (
        <div>
          {ide.mcp_configured ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onUninstall}
              disabled={isInstalling}
              className="text-destructive hover:text-destructive"
            >
              {isInstalling ? (
                <>
                  <RefreshCw className="size-4 mr-2 animate-spin" />
                  {translations.installing}
                </>
              ) : (
                translations.uninstall
              )}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={onInstall}
              disabled={isInstalling}
            >
              {isInstalling ? (
                <>
                  <RefreshCw className="size-4 mr-2 animate-spin" />
                  {translations.installing}
                </>
              ) : (
                translations.install
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
