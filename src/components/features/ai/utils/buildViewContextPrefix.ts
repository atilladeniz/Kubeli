import type { ViewContext } from "../hooks/useViewContext";

/**
 * Converts ViewContext into a short metadata prefix prepended to user messages.
 * Returns empty string when context adds no useful info (e.g. cluster-overview with no selection).
 */
export function buildViewContextPrefix(ctx: ViewContext): string {
  const parts: string[] = [];

  // Skip generic views with no extra context
  const isGenericView =
    ctx.activeView === "cluster-overview" &&
    !ctx.selectedResource &&
    !ctx.logContext;
  if (isGenericView) return "";

  // Active view
  if (ctx.activeView !== "cluster-overview") {
    parts.push(`[View: ${ctx.activeViewTitle || ctx.activeView}]`);
  }

  // Selected namespaces
  if (ctx.selectedNamespaces.length > 0 && ctx.selectedNamespaces.length <= 5) {
    parts.push(`[Namespaces: ${ctx.selectedNamespaces.join(", ")}]`);
  }

  // Log context
  if (ctx.logContext) {
    const { namespace, podName, container, isStreaming, logLineCount } =
      ctx.logContext;
    const containerPart = container ? `, container "${container}"` : "";
    const streamPart = isStreaming ? ", streaming" : "";
    parts.push(
      `[Viewing logs for pod "${podName}" in namespace "${namespace}"${containerPart}${streamPart}, ${logLineCount} lines]`
    );
  }

  // Selected resource
  if (ctx.selectedResource) {
    const { type, name, namespace } = ctx.selectedResource;
    const nsPart = namespace ? ` in namespace "${namespace}"` : "";
    parts.push(`[Selected ${type}: "${name}"${nsPart}]`);
  }

  if (parts.length === 0) return "";
  return parts.join(" ") + "\n";
}
