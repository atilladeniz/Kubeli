"use client";

import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, RefreshCw, ShieldAlert, Wifi, WifiOff, Clock, Ban, Server } from "lucide-react";
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

export function ResourceError({ error, onRetry }: ResourceErrorProps) {
  const [showDetails, setShowDetails] = useState(false);

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
              onClick={() => setShowDetails(!showDetails)}
              className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showDetails ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              Details
            </button>
          )}

          {showDetails && error.detail && (
            <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 font-mono text-xs text-muted-foreground">
              {error.detail}
            </pre>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
