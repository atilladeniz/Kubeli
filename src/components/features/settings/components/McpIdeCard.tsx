import { CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { McpIdeCardProps } from "../types";
import { IDE_LOGOS } from "./ide-logos";

export function McpIdeCard({
  ide,
  isInstalling,
  onInstall,
  onUninstall,
  translations,
}: McpIdeCardProps) {
  const Logo = IDE_LOGOS[ide.id];

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
            "flex size-10 items-center justify-center rounded-lg",
            ide.installed
              ? "bg-brand/12 text-foreground"
              : "bg-[var(--surface-hover)] text-muted-foreground"
          )}
        >
          {Logo ? <Logo className="size-5" /> : <span className="text-sm font-bold">?</span>}
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
