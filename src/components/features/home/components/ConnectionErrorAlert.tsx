import { useTranslations } from "next-intl";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ConnectionErrorAlertProps {
  error: string;
  canDownloadDebugLog: boolean;
  isDownloadingDebugLog: boolean;
  onDownloadDebugLog: () => void;
}

export function ConnectionErrorAlert({
  error,
  canDownloadDebugLog,
  isDownloadingDebugLog,
  onDownloadDebugLog,
}: ConnectionErrorAlertProps) {
  const td = useTranslations("debug");

  return (
    <Alert variant="destructive" className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4" />
        <AlertDescription>{error}</AlertDescription>
      </div>
      {canDownloadDebugLog && (
        <div className="flex flex-wrap gap-2 pl-6">
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadDebugLog}
            disabled={isDownloadingDebugLog}
            className="gap-2"
          >
            {isDownloadingDebugLog ? (
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
