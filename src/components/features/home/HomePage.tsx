import { useState } from "react";
import { useTranslations } from "next-intl";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { generateDebugLog } from "@/lib/tauri/commands";
import { SettingsPanel } from "@/components/features/settings/SettingsPanel";
import { RestartDialog } from "@/components/features/updater/RestartDialog";
import { HomeTitlebar } from "./components/HomeTitlebar";
import { ConnectionErrorAlert } from "./components/ConnectionErrorAlert";
import { ClusterGrid } from "./components/ClusterGrid";
import { WelcomeSection } from "./components/WelcomeSection";
import { HomeFooter } from "./components/HomeFooter";
import packageJson from "../../../../package.json";

interface HomePageProps {
  isTauri: boolean;
  isReady: boolean;
}

export function HomePage({ isTauri, isReady }: HomePageProps) {
  const td = useTranslations("debug");
  const [isDownloadingDebugLog, setIsDownloadingDebugLog] = useState(false);

  const {
    clusters,
    error,
    lastConnectionErrorContext,
    lastConnectionErrorMessage,
  } = useClusterStore();

  const canDownloadDebugLog = Boolean(
    isTauri &&
      error &&
      lastConnectionErrorContext &&
      lastConnectionErrorMessage &&
      error === lastConnectionErrorMessage,
  );

  const handleDownloadDebugLog = async () => {
    if (!lastConnectionErrorContext || !canDownloadDebugLog) {
      toast.error(td("onlyAvailable"));
      return;
    }

    setIsDownloadingDebugLog(true);
    try {
      const logContent = await generateDebugLog(
        lastConnectionErrorContext,
        lastConnectionErrorMessage ?? error ?? undefined,
      );
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const defaultName = `kubeli-debug-${timestamp}.log`;
      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: "Log Files", extensions: ["log", "txt"] }],
      });

      if (!filePath) {
        return;
      }

      await writeTextFile(filePath, logContent);
      const filename = filePath.split(/[/\\]/).pop() ?? filePath;
      toast.success(td("logSaved"), { description: filename });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(td("logFailed"), { description: message });
      console.error("Failed to generate debug log:", err);
    } finally {
      setIsDownloadingDebugLog(false);
    }
  };

  return (
    <div
      className={`flex h-screen flex-col bg-background text-foreground transition-opacity duration-200 ${
        isReady ? "opacity-100" : "opacity-0"
      }`}
    >
      <HomeTitlebar />

      <main className="flex flex-1 flex-col gap-6 overflow-auto p-6">
        {error && (
          <ConnectionErrorAlert
            error={error}
            canDownloadDebugLog={canDownloadDebugLog}
            isDownloadingDebugLog={isDownloadingDebugLog}
            onDownloadDebugLog={handleDownloadDebugLog}
          />
        )}

        {isTauri && <ClusterGrid />}

        {(!isTauri || clusters.length === 0) && (
          <WelcomeSection isTauri={isTauri} />
        )}
      </main>

      <HomeFooter version={packageJson.version} />

      <SettingsPanel />
      <RestartDialog />
    </div>
  );
}
