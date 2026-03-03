import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Loader2, X } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { generateDebugLog } from "@/lib/tauri/commands";
import { getErrorMessage } from "@/lib/types/errors";

export function ConnectionErrorAlert() {
  const td = useTranslations("debug");
  const [isDownloading, setIsDownloading] = useState(false);

  const { error, lastConnectionErrorContext, lastConnectionErrorMessage, setError } =
    useClusterStore();

  const canDownloadDebugLog = Boolean(
    error &&
      lastConnectionErrorContext &&
      lastConnectionErrorMessage &&
      error.message === lastConnectionErrorMessage,
  );

  const handleDownloadDebugLog = async () => {
    if (!lastConnectionErrorContext || !canDownloadDebugLog) {
      toast.error(td("onlyAvailable"));
      return;
    }

    setIsDownloading(true);
    try {
      const logContent = await generateDebugLog(
        lastConnectionErrorContext,
        lastConnectionErrorMessage ?? (error ? error.message : undefined),
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
      toast.error(td("logFailed"), { description: getErrorMessage(err) });
      console.error("Failed to generate debug log:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!error) return null;

  return (
    <Alert variant="destructive" className="relative flex flex-col gap-2">
      <div className="flex items-start gap-2 pr-6">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <AlertDescription>
          {lastConnectionErrorContext && (
            <span className="font-medium">{lastConnectionErrorContext}: </span>
          )}
          {error.message}
        </AlertDescription>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute right-1.5 top-1.5 size-6 rounded text-muted-foreground/70 hover:text-foreground"
        onClick={() => setError(null)}
      >
        <X className="size-3.5" />
      </Button>
      {canDownloadDebugLog && (
        <div className="flex flex-wrap gap-2 pl-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadDebugLog}
            disabled={isDownloading}
            className="gap-2"
          >
            {isDownloading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {td("saving")}
              </>
            ) : (
              td("downloadLog")
            )}
          </Button>
        </div>
      )}
    </Alert>
  );
}
