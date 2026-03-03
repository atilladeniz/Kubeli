/** Error kinds matching the Rust ErrorKind enum */
export type ErrorKind =
  | "Forbidden"
  | "Unauthorized"
  | "NotFound"
  | "Conflict"
  | "RateLimited"
  | "ServerError"
  | "Network"
  | "Timeout"
  | "Unknown";

/** Structured error type matching the Rust KubeliError struct */
export interface KubeliError {
  kind: ErrorKind;
  code?: number;
  message: string;
  detail?: string;
  resource?: string;
  suggestions: string[];
  retryable: boolean;
}

/** Type guard to check if a value is a KubeliError */
export function isKubeliError(value: unknown): value is KubeliError {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.kind === "string" &&
    typeof obj.message === "string" &&
    typeof obj.retryable === "boolean" &&
    Array.isArray(obj.suggestions)
  );
}

/** Extract a user-friendly message string from any error value */
export function getErrorMessage(error: unknown): string {
  if (isKubeliError(error)) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unknown error occurred";
}

/** Wrap any error value into a KubeliError */
export function toKubeliError(error: unknown): KubeliError {
  if (isKubeliError(error)) return error;

  // Try parsing as JSON (Tauri serializes KubeliError as JSON string)
  if (typeof error === "string") {
    try {
      const parsed = JSON.parse(error);
      if (isKubeliError(parsed)) return parsed;
    } catch {
      // Not JSON, treat as plain string
    }
    return {
      kind: "Unknown",
      message: error,
      suggestions: [],
      retryable: true,
    };
  }

  if (error instanceof Error) {
    return {
      kind: "Unknown",
      message: error.message,
      suggestions: [],
      retryable: true,
    };
  }

  return {
    kind: "Unknown",
    message: String(error),
    suggestions: [],
    retryable: true,
  };
}
