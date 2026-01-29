import { CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { McpIdeCardProps } from "../types";

const IDE_ICONS: Record<string, string> = {
  claude_code: "C",
  codex: "O",
  vscode: "VS",
  cursor: "Cu",
};

export function McpIdeCard({
  ide,
  isInstalling,
  onInstall,
  onUninstall,
  translations,
}: McpIdeCardProps) {
  const icon = IDE_ICONS[ide.id] || "?";

  return (
    <div
      className={cn(
        "rounded-lg border p-4 flex items-center justify-between",
        ide.installed && ide.mcp_configured && "border-green-500/30 bg-green-500/5",
        ide.installed && !ide.mcp_configured && "border-muted",
        !ide.installed && "border-muted bg-muted/30"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "size-10 rounded-lg flex items-center justify-center text-sm font-bold",
            ide.installed
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{ide.name}</span>
            {ide.mcp_configured && (
              <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">
                <CheckCircle className="size-3" />
                {translations.installed}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {ide.installed
              ? ide.mcp_configured
                ? ide.config_path
                : translations.notInstalled
              : translations.notDetected}
          </p>
        </div>
      </div>

      {ide.installed && (
        <div>
          {ide.mcp_configured ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onUninstall}
              disabled={isInstalling}
              className="text-destructive hover:text-destructive"
            >
              {isInstalling ? (
                <>
                  <RefreshCw className="size-4 mr-2 animate-spin" />
                  {translations.installing}
                </>
              ) : (
                translations.uninstall
              )}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={onInstall}
              disabled={isInstalling}
            >
              {isInstalling ? (
                <>
                  <RefreshCw className="size-4 mr-2 animate-spin" />
                  {translations.installing}
                </>
              ) : (
                translations.install
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
