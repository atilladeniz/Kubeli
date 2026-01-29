import { useTranslations } from "next-intl";
import { RefreshCw, Bot } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useUIStore, type AiCliProvider } from "@/lib/stores/ui-store";
import { usePlatform } from "@/lib/hooks/usePlatform";
import { SettingSection } from "./SettingSection";
import { CliStatusCard } from "./CliStatusCard";
import type { useAiCli } from "../hooks";

type AiCliReturn = ReturnType<typeof useAiCli>;

interface AiTabProps {
  aiCli: AiCliReturn;
}

export function AiTab({ aiCli }: AiTabProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const { settings, updateSettings } = useUIStore();
  const { isWindows } = usePlatform();

  const cliTranslations = {
    authenticated: t("ai.authenticated"),
    notAuthenticated: t("ai.notAuthenticated"),
    notInstalled: t("ai.notInstalled"),
    checking: t("ai.checking"),
    clickRefresh: t("ai.clickRefresh"),
    active: t("ai.active"),
  };

  return (
    <div className="space-y-6">
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
          onClick={aiCli.checkClis}
          disabled={aiCli.checking}
        >
          {aiCli.checking ? (
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
        info={aiCli.claudeCliInfo}
        isChecking={aiCli.checking}
        isSelected={(settings.aiCliProvider || "claude") === "claude"}
        installInstructions={
          <ClaudeInstallInstructions isWindows={isWindows} />
        }
        translations={cliTranslations}
      />

      {/* Codex CLI Status */}
      <CliStatusCard
        name={t("ai.codex")}
        info={aiCli.codexCliInfo}
        isChecking={aiCli.checking}
        isSelected={settings.aiCliProvider === "codex"}
        installInstructions={
          <CodexInstallInstructions isWindows={isWindows} />
        }
        translations={cliTranslations}
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
    </div>
  );
}

function ClaudeInstallInstructions({ isWindows }: { isWindows: boolean }) {
  const t = useTranslations("settings");

  return (
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
  );
}

function CodexInstallInstructions({ isWindows }: { isWindows: boolean }) {
  const t = useTranslations("settings");

  return (
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
  );
}
