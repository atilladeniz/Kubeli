import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  RefreshCw,
  Plug,
  MessageSquare,
  Copy,
  Check,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { McpIdeCard } from "./McpIdeCard";
import type { useMcpIdes } from "../hooks";

type McpIdesReturn = ReturnType<typeof useMcpIdes>;

interface McpTabProps {
  mcp: McpIdesReturn;
}

export function McpTab({ mcp }: McpTabProps) {
  const t = useTranslations("settings");
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const handleCopyPrompt = useCallback(async (prompt: string, key: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(key);
      setTimeout(() => setCopiedPrompt(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

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

  const ideTranslations = {
    installed: t("mcp.installed"),
    notInstalled: t("mcp.notInstalled"),
    notDetected: t("mcp.notDetected"),
    install: t("mcp.install"),
    uninstall: t("mcp.uninstall"),
    installing: t("mcp.installing"),
  };

  return (
    <div className="space-y-6">
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
          onClick={mcp.checkIdes}
          disabled={mcp.loading}
        >
          {mcp.loading ? (
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
        {mcp.ides.map((ide) => (
          <McpIdeCard
            key={ide.id}
            ide={ide}
            isInstalling={mcp.installingId === ide.id}
            onInstall={() => mcp.install(ide.id, ide.name)}
            onUninstall={() => mcp.uninstall(ide.id, ide.name)}
            translations={ideTranslations}
          />
        ))}
        {mcp.ides.length === 0 && !mcp.loading && (
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
          {mcp.kubeliPath || "..."}
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
          onClick={() => setExamplesOpen(true)}
        >
          <MessageSquare className="size-4 mr-2" />
          {t("mcp.showExamples")}
        </Button>
      </div>

      {/* Example Prompts Dialog */}
      <Dialog open={examplesOpen} onOpenChange={setExamplesOpen}>
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
    </div>
  );
}
