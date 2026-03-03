"use client";

import { useCallback, useState } from "react";
import { AlertCircle, Check, ChevronDown, ChevronRight, Copy, RefreshCw, ShieldAlert, Wifi, WifiOff, Clock, Ban, Server } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { KubeliError, ErrorKind } from "@/lib/types/errors";

const ERROR_TITLES: Record<ErrorKind, string> = {
  Forbidden: "Access Denied",
  Unauthorized: "Authentication Failed",
  NotFound: "Not Found",
  Conflict: "Conflict",
  RateLimited: "Rate Limited",
  ServerError: "Server Error",
  Network: "Connection Error",
  Timeout: "Request Timed Out",
  Unknown: "Error",
};

const ERROR_ICONS: Record<ErrorKind, React.ReactNode> = {
  Forbidden: <ShieldAlert className="size-4" />,
  Unauthorized: <ShieldAlert className="size-4" />,
  NotFound: <Ban className="size-4" />,
  Conflict: <AlertCircle className="size-4" />,
  RateLimited: <Clock className="size-4" />,
  ServerError: <Server className="size-4" />,
  Network: <WifiOff className="size-4" />,
  Timeout: <Clock className="size-4" />,
  Unknown: <AlertCircle className="size-4" />,
};

interface ResourceErrorProps {
  error: KubeliError;
  onRetry?: () => void;
}

// Keep details open across re-mounts (refresh cycles)
let detailsWasOpen = false;

export function ResourceError({ error, onRetry }: ResourceErrorProps) {
  const [showDetails, setShowDetails] = useState(detailsWasOpen);
  const [copied, setCopied] = useState(false);

  const toggleDetails = useCallback(() => {
    setShowDetails((prev) => {
      detailsWasOpen = !prev;
      return !prev;
    });
  }, []);

  const copyDetail = useCallback(() => {
    if (!error.detail) return;
    navigator.clipboard.writeText(error.detail);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [error.detail]);

  const title = ERROR_TITLES[error.kind] || "Error";
  const icon = ERROR_ICONS[error.kind] || <AlertCircle className="size-4" />;

  return (
    <div className="mx-4 mt-3">
      <Alert variant="destructive">
        {icon}
        <AlertTitle className="flex items-center justify-between">
          <span>{title}</span>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="ml-2 h-6 gap-1 px-2 text-xs"
            >
              {error.retryable ? (
                <>
                  <Wifi className="size-3" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="size-3" />
                  Retry
                </>
              )}
            </Button>
          )}
        </AlertTitle>
        <AlertDescription>
          <p>{error.message}</p>

          {error.suggestions.length > 0 && (
            <ul className="mt-1.5 list-disc pl-4 text-xs text-muted-foreground">
              {error.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}

          {error.detail && (
            <button
              onClick={toggleDetails}
              className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showDetails ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              Details
            </button>
          )}

          {showDetails && error.detail && (
            <div className="relative mt-1">
              <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-all rounded bg-muted/50 p-2 pr-8 font-mono text-xs text-muted-foreground select-text">
                {error.detail}
              </pre>
              <button
                onClick={copyDetail}
                className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Copy details"
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              </button>
            </div>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
