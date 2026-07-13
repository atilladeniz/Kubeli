import { useState, useCallback, useEffect } from "react";
import {
  aiCheckCliAvailable,
  aiCheckCodexCliAvailable,
  aiCheckDroidCliAvailable,
  aiCheckOpenCodeCliAvailable,
  type CliInfo,
  type CliStatus,
} from "@/lib/tauri/commands";
import { useUIStore, type AiCliProvider } from "@/lib/stores/ui-store";
import { getErrorMessage } from "@/lib/types/errors";

const errorInfo = (err: unknown): CliInfo => ({
  status: "error" as CliStatus,
  version: null,
  cli_path: null,
  error_message: getErrorMessage(err),
});

export function useAiCli(isOpen: boolean) {
  const settings = useUIStore((s) => s.settings);
  const updateSettings = useUIStore((s) => s.updateSettings);
  const [claudeCliInfo, setClaudeCliInfo] = useState<CliInfo | null>(null);
  const [codexCliInfo, setCodexCliInfo] = useState<CliInfo | null>(null);
  const [opencodeCliInfo, setOpencodeCliInfo] = useState<CliInfo | null>(null);
  const [droidCliInfo, setDroidCliInfo] = useState<CliInfo | null>(null);
  const [checking, setChecking] = useState(false);

  const checkClis = useCallback(async () => {
    setChecking(true);
    try {
      const [claudeInfo, codexInfo, opencodeInfo, droidInfo] = await Promise.all([
        aiCheckCliAvailable().catch(errorInfo),
        aiCheckCodexCliAvailable().catch(errorInfo),
        aiCheckOpenCodeCliAvailable().catch(errorInfo),
        aiCheckDroidCliAvailable().catch(errorInfo),
      ]);
      setClaudeCliInfo(claudeInfo);
      setCodexCliInfo(codexInfo);
      setOpencodeCliInfo(opencodeInfo);
      setDroidCliInfo(droidInfo);

      const availability: Record<AiCliProvider, boolean> = {
        claude: claudeInfo.status === "authenticated",
        codex: codexInfo.status === "authenticated",
        opencode: opencodeInfo.status === "authenticated",
        droid: droidInfo.status === "authenticated",
      };
      // Auto-select only when the user has not picked a provider yet —
      // never override an explicit choice on re-detection.
      // Preference order: claude, opencode, codex, droid.
      const fallbackOrder: AiCliProvider[] = [
        "claude",
        "opencode",
        "codex",
        "droid",
      ];
      const firstAvailable = fallbackOrder.find((p) => availability[p]);

      if (!settings.aiCliProvider && firstAvailable) {
        updateSettings({ aiCliProvider: firstAvailable });
      }
    } catch (err) {
      console.error("Failed to check AI CLIs:", err);
    } finally {
      setChecking(false);
    }
  }, [settings.aiCliProvider, updateSettings]);

  useEffect(() => {
    if (
      isOpen &&
      !claudeCliInfo &&
      !codexCliInfo &&
      !opencodeCliInfo &&
      !droidCliInfo &&
      !checking
    ) {
      checkClis();
    }
  }, [
    isOpen,
    claudeCliInfo,
    codexCliInfo,
    opencodeCliInfo,
    droidCliInfo,
    checking,
    checkClis,
  ]);

  return {
    claudeCliInfo,
    codexCliInfo,
    opencodeCliInfo,
    droidCliInfo,
    checking,
    checkClis,
  };
}
