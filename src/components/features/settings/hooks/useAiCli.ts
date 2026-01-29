import { useState, useCallback, useEffect } from "react";
import {
  aiCheckCliAvailable,
  aiCheckCodexCliAvailable,
  type CliInfo,
  type CliStatus,
} from "@/lib/tauri/commands";
import { useUIStore } from "@/lib/stores/ui-store";

export function useAiCli(isOpen: boolean) {
  const { settings, updateSettings } = useUIStore();
  const [claudeCliInfo, setClaudeCliInfo] = useState<CliInfo | null>(null);
  const [codexCliInfo, setCodexCliInfo] = useState<CliInfo | null>(null);
  const [checking, setChecking] = useState(false);

  const checkClis = useCallback(async () => {
    setChecking(true);
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

      const claudeAvailable = claudeInfo.status === "authenticated";
      const codexAvailable = codexInfo.status === "authenticated";
      const currentProvider = settings.aiCliProvider || "claude";

      if (currentProvider === "claude" && !claudeAvailable && codexAvailable) {
        updateSettings({ aiCliProvider: "codex" });
      } else if (currentProvider === "codex" && !codexAvailable && claudeAvailable) {
        updateSettings({ aiCliProvider: "claude" });
      } else if (!settings.aiCliProvider) {
        if (claudeAvailable) {
          updateSettings({ aiCliProvider: "claude" });
        } else if (codexAvailable) {
          updateSettings({ aiCliProvider: "codex" });
        }
      }
    } catch (err) {
      console.error("Failed to check AI CLIs:", err);
    } finally {
      setChecking(false);
    }
  }, [settings.aiCliProvider, updateSettings]);

  useEffect(() => {
    if (isOpen && !claudeCliInfo && !codexCliInfo && !checking) {
      checkClis();
    }
  }, [isOpen, claudeCliInfo, codexCliInfo, checking, checkClis]);

  return {
    claudeCliInfo,
    codexCliInfo,
    checking,
    checkClis,
  };
}
