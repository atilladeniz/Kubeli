import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Bot, Copy } from "lucide-react";
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
import type { CliInfo } from "@/lib/tauri/commands";
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
  const settings = useUIStore((s) => s.settings);
  const updateSettings = useUIStore((s) => s.updateSettings);
  const { isWindows } = usePlatform();

  const cliTranslations = {
    authenticated: t("ai.authenticated"),
    notAuthenticated: t("ai.notAuthenticated"),
    notInstalled: t("ai.notInstalled"),
    checking: t("ai.checking"),
    clickRefresh: t("ai.clickRefresh"),
    active: t("ai.active"),
  };

  // A provider is selectable once we've confirmed the CLI is on disk.
  // While checking (info === null) we keep options enabled to avoid flicker.
  const isUnavailable = (info: CliInfo | null) =>
    info !== null && info.status === "notinstalled";

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
            <SelectItem
              value="claude"
              disabled={isUnavailable(aiCli.claudeCliInfo)}
            >
              {t("ai.claudeCode")}
            </SelectItem>
            <SelectItem
              value="codex"
              disabled={isUnavailable(aiCli.codexCliInfo)}
            >
              {t("ai.codex")}
            </SelectItem>
            <SelectItem
              value="opencode"
              disabled={isUnavailable(aiCli.opencodeCliInfo)}
            >
              {t("ai.opencode")}
            </SelectItem>
            <SelectItem
              value="droid"
              disabled={isUnavailable(aiCli.droidCliInfo)}
            >
              {t("ai.droid")}
            </SelectItem>
          </SelectContent>
        </Select>
      </SettingSection>

      <Separator />

      {/* CLI Status Header with Refresh */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-sm font-medium">{t("ai.cliStatus")}</Label>
          <p className="text-sm text-muted-foreground">
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

      {/* OpenCode CLI Status */}
      <CliStatusCard
        name={t("ai.opencode")}
        info={aiCli.opencodeCliInfo}
        isChecking={aiCli.checking}
        isSelected={settings.aiCliProvider === "opencode"}
        installInstructions={
          <OpenCodeInstallInstructions isWindows={isWindows} />
        }
        translations={cliTranslations}
      />

      {/* Droid CLI Status */}
      <CliStatusCard
        name={t("ai.droid")}
        info={aiCli.droidCliInfo}
        isChecking={aiCli.checking}
        isSelected={settings.aiCliProvider === "droid"}
        installInstructions={
          <DroidInstallInstructions isWindows={isWindows} />
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
        <p className="text-sm">
          {t("ai.howItWorksDescription")}
        </p>
        <p className="text-sm font-medium text-foreground mt-2">
          {t("ai.aiCanHelp")}
        </p>
        <ul className="text-sm space-y-1 ml-6 list-disc">
          <li>{t("ai.helpAnalyze")}</li>
          <li>{t("ai.helpLogs")}</li>
          <li>{t("ai.helpHealth")}</li>
          <li>{t("ai.helpExplain")}</li>
        </ul>
      </div>
    </div>
  );
}

function CopyableCode({ children }: { children: string }) {
  const tc = useTranslations("common");
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  // Keyed into the motion elements so rapid re-clicks replay the draw animation
  const [copyCount, setCopyCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // execCommand fallback for when the async Clipboard API is unavailable or
  // denied — copies via a temporary off-screen textarea.
  const copyViaExecCommand = () => {
    const textarea = document.createElement("textarea");
    textarea.value = children;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
  };

  const handleCopy = async () => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(children);
    } catch {
      ok = copyViaExecCommand();
    }
    setStatus(ok ? "copied" : "error");
    setCopyCount((c) => c + 1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus("idle"), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={
        status === "copied" ? tc("copied") : `${tc("copy")}: ${children}`
      }
      className="group flex w-full cursor-pointer items-center gap-2 rounded-md bg-background text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <code className="min-w-0 flex-1 truncate py-2 pl-3 font-mono text-xs">
        <mark className="bg-transparent text-foreground transition-colors group-hover:bg-brand/20">
          {children}
        </mark>
      </code>
      <span className="shrink-0 px-2.5 py-2 text-muted-foreground transition-colors group-hover:text-foreground">
        {status === "copied" ? (
          <span
            key={`check-${copyCount}`}
            className="copy-feedback-pop flex items-center justify-center text-green-500"
          >
            <svg
              width={14}
              height={14}
              viewBox="2 4 20 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path className="copy-feedback-draw" pathLength={1} d="M6 12L10 16L18 8" />
            </svg>
          </span>
        ) : status === "error" ? (
          <span
            key={`error-${copyCount}`}
            className="copy-feedback-pop flex items-center justify-center text-destructive"
          >
            <svg
              width={14}
              height={14}
              viewBox="2 4 20 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path className="copy-feedback-draw" pathLength={1} d="M9 9L15 15M15 9L9 15" />
            </svg>
          </span>
        ) : (
          <span className="copy-feedback-pop flex items-center justify-center">
            <Copy className="size-3.5" />
          </span>
        )}
      </span>
    </button>
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
            <p className="text-sm text-muted-foreground/80">
              {t("ai.installClaudeNative")} (PowerShell)
            </p>
            <CopyableCode>{"irm https://claude.ai/install.ps1 | iex"}</CopyableCode>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground/80">
              {t("ai.installClaudeWinget")}
            </p>
            <CopyableCode>{"winget install Anthropic.ClaudeCode"}</CopyableCode>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground/80">
              {t("ai.installClaudeNative")}
            </p>
            <CopyableCode>{"curl -fsSL https://claude.ai/install.sh | bash"}</CopyableCode>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground/80">
              {t("ai.installClaudeBrew")}
            </p>
            <CopyableCode>{"brew install --cask claude-code"}</CopyableCode>
          </div>
        </>
      )}
      <p className="text-sm">
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
        <p className="text-sm text-muted-foreground/80">
          {t("ai.installCodexNpm")}
        </p>
        <CopyableCode>{"npm i -g @openai/codex"}</CopyableCode>
      </div>
      {!isWindows && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground/80">
            {t("ai.installCodexBrew")}
          </p>
          <CopyableCode>{"brew install codex"}</CopyableCode>
        </div>
      )}
      <p className="text-sm">
        {t("ai.installCodexAuth")}
      </p>
    </div>
  );
}

function OpenCodeInstallInstructions({ isWindows }: { isWindows: boolean }) {
  const t = useTranslations("settings");

  return (
    <div className="space-y-3">
      <p className="font-medium">{t("ai.installOpencode")}</p>
      {isWindows ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground/80">
            {t("ai.installOpencodeNpm")}
          </p>
          <CopyableCode>{"npm i -g opencode-ai"}</CopyableCode>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground/80">
              {t("ai.installOpencodeScript")}
            </p>
            <CopyableCode>{"curl -fsSL https://opencode.ai/install | bash"}</CopyableCode>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground/80">
              {t("ai.installOpencodeBrew")}
            </p>
            <CopyableCode>{"brew install sst/tap/opencode"}</CopyableCode>
          </div>
        </>
      )}
      <p className="text-sm">{t("ai.installOpencodeAuth")}</p>
    </div>
  );
}

function DroidInstallInstructions({ isWindows }: { isWindows: boolean }) {
  const t = useTranslations("settings");

  return (
    <div className="space-y-3">
      <p className="font-medium">{t("ai.installDroid")}</p>
      {isWindows ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground/80">
            {t("ai.installDroidScript")} (PowerShell)
          </p>
          <CopyableCode>{"irm https://app.factory.ai/cli/windows | iex"}</CopyableCode>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground/80">
            {t("ai.installDroidScript")}
          </p>
          <CopyableCode>{"curl -fsSL https://app.factory.ai/cli | sh"}</CopyableCode>
        </div>
      )}
      <p className="text-sm">{t("ai.installDroidAuth")}</p>
    </div>
  );
}
