import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  mcpDetectIdes,
  mcpInstallIde,
  mcpUninstallIde,
  mcpGetKubeliPath,
  type McpIdeInfo,
} from "@/lib/tauri/commands";

export function useMcpIdes(isOpen: boolean) {
  const t = useTranslations("settings");
  const [ides, setIdes] = useState<McpIdeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [kubeliPath, setKubeliPath] = useState<string>("");
  const [installingId, setInstallingId] = useState<string | null>(null);

  const checkIdes = useCallback(async () => {
    setLoading(true);
    try {
      const [detectedIdes, path] = await Promise.all([
        mcpDetectIdes(),
        mcpGetKubeliPath(),
      ]);
      setIdes(detectedIdes);
      setKubeliPath(path);
    } catch (err) {
      console.error("Failed to detect IDEs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && ides.length === 0 && !loading) {
      checkIdes();
    }
  }, [isOpen, ides.length, loading, checkIdes]);

  const install = useCallback(async (ideId: string, ideName: string) => {
    setInstallingId(ideId);
    try {
      await mcpInstallIde(ideId);
      toast.success(t("mcp.installSuccess", { ide: ideName }));
      await checkIdes();
    } catch (err) {
      console.error("Failed to install MCP:", err);
      toast.error(t("mcp.installError"));
    } finally {
      setInstallingId(null);
    }
  }, [checkIdes, t]);

  const uninstall = useCallback(async (ideId: string, ideName: string) => {
    setInstallingId(ideId);
    try {
      await mcpUninstallIde(ideId);
      toast.success(t("mcp.uninstallSuccess", { ide: ideName }));
      await checkIdes();
    } catch (err) {
      console.error("Failed to uninstall MCP:", err);
      toast.error(t("mcp.uninstallError"));
    } finally {
      setInstallingId(null);
    }
  }, [checkIdes, t]);

  return {
    ides,
    loading,
    kubeliPath,
    installingId,
    checkIdes,
    install,
    uninstall,
  };
}
