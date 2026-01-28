"use client";

import { memo, useMemo, useCallback, useState } from "react";
import { Sparkles, User, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { cn } from "@/lib/utils";
import { createMarkdownComponents } from "../lib/markdownComponents";
import type { ChatMessage } from "@/lib/stores/ai-store";

interface MessageRendererProps {
  /** The message to render */
  message: ChatMessage;
  /** Whether the AI is currently streaming */
  isStreaming: boolean;
  /** Current thinking message to display (translated) */
  thinkingMessage: string;
  /** Callback when a kubeli:// link is clicked */
  onKubeliLink: (namespace: string, podName: string) => void;
}

/** Format timestamp to HH:MM */
function formatTime(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Renders a single chat message with appropriate styling for user/assistant.
 * Handles markdown rendering, code blocks, and special kubeli:// links.
 * Memoized to prevent unnecessary re-renders during streaming.
 */
export const MessageRenderer = memo(function MessageRenderer({
  message,
  isStreaming,
  thinkingMessage,
  onKubeliLink,
}: MessageRendererProps) {
  const t = useTranslations("ai");
  const tc = useTranslations("common");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isUser = message.role === "user";
  const isCopied = copiedId === message.id;

  // Get locale for date formatting (defaults to browser locale)
  const locale = typeof navigator !== "undefined" ? navigator.language : "en";

  // Memoize markdown components to avoid recreation
  const markdownComponents = useMemo(
    () => createMarkdownComponents({ onKubeliLink }),
    [onKubeliLink]
  );

  // Copy message to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      toast.success(tc("copied"));
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error(t("copyFailed"));
    }
  }, [message.content, message.id, tc, t]);

  return (
    <div
      className={cn(
        "group flex gap-3 p-4",
        isUser ? "bg-muted/40" : "bg-background"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
        )}
      >
        {isUser ? <User className="size-4" /> : <Sparkles className="size-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2 select-text">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {isUser ? t("you") : t("assistant")}
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              {formatTime(message.timestamp, locale)}
            </span>
          </div>

          {/* Copy button for assistant messages */}
          {!isUser && message.content && !message.isStreaming && (
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2 cursor-pointer"
              onClick={handleCopy}
            >
              {isCopied ? (
                <Check className="size-3 text-green-500" />
              ) : (
                <Copy className="size-3" />
              )}
            </Button>
          )}
        </div>

        {/* Message content */}
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted prose-pre:border prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
          {isUser ? (
            <p className="whitespace-pre-wrap break-words text-sm">
              {message.content}
            </p>
          ) : (
            <>
              {/* Show shimmer indicator while streaming */}
              {message.isStreaming && isStreaming ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-violet-500" />
                  <ShimmeringText
                    text={thinkingMessage}
                    duration={1.5}
                    className="text-sm"
                    startOnView={false}
                  />
                </div>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {message.content}
                </ReactMarkdown>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});
