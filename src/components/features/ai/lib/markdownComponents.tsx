import type { Components } from "react-markdown";
import { toast } from "sonner";

interface MarkdownComponentsOptions {
  /** Callback when a kubeli:// link is clicked */
  onKubeliLink?: (namespace: string, podName: string) => void;
}

/**
 * Custom ReactMarkdown components for AI assistant messages.
 * Provides consistent styling and handles special kubeli:// links.
 */
export function createMarkdownComponents(
  options: MarkdownComponentsOptions = {}
): Components {
  const { onKubeliLink } = options;

  return {
    // Code blocks
    pre: ({ children }) => (
      <pre className="overflow-x-auto rounded-lg bg-muted/50 border p-3 text-xs my-3 whitespace-pre-wrap break-words">
        {children}
      </pre>
    ),

    code: ({ className, children, ...props }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code
            className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code className="text-xs font-mono block" {...props}>
          {children}
        </code>
      );
    },

    // Lists
    ul: ({ children }) => (
      <ul className="list-disc list-outside ml-4 space-y-1 my-2">{children}</ul>
    ),

    ol: ({ children }) => (
      <ol className="list-decimal list-outside ml-4 space-y-1 my-2">
        {children}
      </ol>
    ),

    li: ({ children }) => <li className="text-sm pl-1">{children}</li>,

    // Headings
    h1: ({ children }) => (
      <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>
    ),

    h2: ({ children }) => (
      <h2 className="text-base font-semibold mt-4 mb-2">{children}</h2>
    ),

    h3: ({ children }) => (
      <h3 className="text-sm font-semibold mt-3 mb-1">{children}</h3>
    ),

    // Paragraphs
    p: ({ children }) => (
      <p className="text-sm leading-relaxed mb-3 last:mb-0">{children}</p>
    ),

    // Strong/Bold
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),

    // Tables
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto rounded-lg border">
        <table className="w-full text-xs border-collapse">{children}</table>
      </div>
    ),

    thead: ({ children }) => (
      <thead className="bg-muted/50">{children}</thead>
    ),

    tbody: ({ children }) => (
      <tbody className="divide-y divide-border">{children}</tbody>
    ),

    tr: ({ children }) => (
      <tr className="border-b border-border last:border-0">{children}</tr>
    ),

    th: ({ children }) => (
      <th className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap">
        {children}
      </th>
    ),

    td: ({ children }) => (
      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
        {children}
      </td>
    ),

    // Links - handle kubeli:// links specially
    a: ({ href, children }) => {
      // Check if it's a kubeli:// internal link
      if (href?.startsWith("kubeli://logs/")) {
        const parts = href.replace("kubeli://logs/", "").split("/");
        const linkNamespace = parts[0];
        const linkPodName = parts.slice(1).join("/");

        return (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onKubeliLink?.(linkNamespace, linkPodName);
              toast.success(`Navigiere zu ${linkNamespace}/${linkPodName}`, {
                description: "Wechsle zur Pods-Ansicht um die Logs zu sehen",
              });
            }}
            style={{ cursor: "pointer" }}
            className="text-primary hover:underline font-medium inline bg-transparent border-none p-0"
          >
            {children}
          </button>
        );
      }

      // For external links, copy to clipboard on click
      return (
        <span
          style={{ cursor: "pointer" }}
          className="text-primary hover:underline"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (href) {
              navigator.clipboard.writeText(href);
              toast.success("Link kopiert!");
            }
          }}
          title={href}
        >
          {children}
        </span>
      );
    },
  };
}
