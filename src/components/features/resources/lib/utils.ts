/** Format a timestamp into a human-readable relative age string */
export function formatAge(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMins > 0) return `${diffMins}m`;
  return `${diffSecs}s`;
}

/** Parse Kubernetes quantity string (e.g., "10Gi", "500Mi") to bytes for sorting */
export function parseQuantityToBytes(quantity: string | null | undefined): number {
  if (!quantity) return 0;

  const units: Record<string, number> = {
    Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, Pi: 1024 ** 5, Ei: 1024 ** 6,
    K: 1e3, k: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15, E: 1e18,
  };

  const match = quantity.trim().match(/^([\d.]+)\s*([A-Za-z]*)$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  return isNaN(value) ? 0 : value * (units[match[2]] || 1);
}

/** Format duration in seconds to human-readable string */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h${mins}m`;
  if (mins > 0) return `${mins}m${secs}s`;
  return `${secs}s`;
}

/** Parse secret data from YAML string */
export function parseSecretFromYaml(yaml: string): { type: string; data: Record<string, string> } | null {
  try {
    const lines = yaml.split("\n");
    let secretType = "Opaque";
    const data: Record<string, string> = {};
    let inDataSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("type:")) {
        secretType = trimmed.replace("type:", "").trim();
        continue;
      }

      if (trimmed === "data:" || trimmed.startsWith("data:")) {
        inDataSection = true;
        if (trimmed !== "data:") {
          inDataSection = false;
        }
        continue;
      }

      if (trimmed === "stringData:" || trimmed.startsWith("stringData:")) {
        inDataSection = true;
        continue;
      }

      if (
        inDataSection &&
        !line.startsWith(" ") &&
        !line.startsWith("\t") &&
        trimmed !== ""
      ) {
        inDataSection = false;
      }

      if (inDataSection && trimmed !== "") {
        const colonIndex = trimmed.indexOf(":");
        if (colonIndex > 0) {
          const currentKey = trimmed.substring(0, colonIndex).trim();
          let currentValue = trimmed.substring(colonIndex + 1).trim();

          if (
            (currentValue.startsWith('"') && currentValue.endsWith('"')) ||
            (currentValue.startsWith("'") && currentValue.endsWith("'"))
          ) {
            currentValue = currentValue.slice(1, -1);
          }

          if (currentKey && currentValue) {
            data[currentKey] = currentValue;
          }
        }
      }
    }

    return { type: secretType, data };
  } catch {
    return null;
  }
}

/** Decode a base64 string, returning original if invalid */
export function decodeBase64(value: string): string {
  try {
    return atob(value);
  } catch {
    return value;
  }
}
