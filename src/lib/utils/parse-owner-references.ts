export interface ParsedOwnerReference {
  apiVersion: string;
  kind: string;
  name: string;
  uid: string;
  controller?: boolean;
}

/**
 * Parse ownerReferences from a Kubernetes resource YAML string.
 * Returns undefined if no ownerReferences are found.
 */
export function parseOwnerReferences(yaml: string): ParsedOwnerReference[] | undefined {
  try {
    // Match the ownerReferences block until the next top-level key at the same or lower indent
    const match = yaml.match(/ownerReferences:\s*\n((?:[ \t]+-[\s\S]*?)(?=\n\S|\n?$))/);
    if (!match) return undefined;

    const refs: ParsedOwnerReference[] = [];
    // Split on YAML list item markers
    const items = match[1].split(/^\s*-\s+/m).filter((s) => s.trim());

    for (const item of items) {
      const fields: Record<string, string> = {};
      for (const line of item.split("\n")) {
        const kv = line.match(/^\s*(\w+):\s*(.+)$/);
        if (kv) {
          fields[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
        }
      }

      if (fields.apiVersion && fields.kind && fields.name && fields.uid) {
        refs.push({
          apiVersion: fields.apiVersion,
          kind: fields.kind,
          name: fields.name,
          uid: fields.uid,
          ...(fields.controller === "true" && { controller: true }),
        });
      }
    }

    return refs.length > 0 ? refs : undefined;
  } catch {
    return undefined;
  }
}
