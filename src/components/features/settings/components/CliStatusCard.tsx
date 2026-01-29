import { useTranslations } from "next-intl";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CliStatusCardProps } from "../types";

export function CliStatusCard({
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

      {info?.status === "notinstalled" && (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
          {installInstructions}
        </div>
      )}
    </div>
  );
}
