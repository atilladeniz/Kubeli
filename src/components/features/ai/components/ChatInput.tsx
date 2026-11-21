"use client";

import { forwardRef, useCallback } from "react";
import { ArrowUp, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ComposerToolbar } from "./ComposerToolbar";
import type { AiCliProvider } from "@/lib/stores/ui-store";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onInterrupt: () => void;
  placeholder: string;
  isStreaming: boolean;
  isThinking: boolean;
  contextChars?: number;
  sessionProvider?: AiCliProvider | null;
}

/**
 * Chat input area with auto-resizing textarea and send/stop buttons.
 */
export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  function ChatInput(
    {
      value,
      onChange,
      onSend,
      onInterrupt,
      placeholder,
      isStreaming,
      isThinking,
      contextChars = 0,
      sessionProvider = null,
    },
    ref,
  ) {
    const t = useTranslations();
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSend();
        }
      },
      [onSend],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
        const textarea = e.target;
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
      },
      [onChange],
    );

    return (
      <div className="p-4">
        {/* Unified message field: textarea and action sit inside one raised
            surface, so the whole composer reads as a single control rather
            than a box plus a floating button. */}
        <div className="bg-surface-3 shadow-surface-3 border-surface-border focus-within:ring-ring/40 flex flex-col gap-1 rounded-2xl border p-2 transition-shadow focus-within:ring-2">
          <Textarea
            ref={ref}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="max-h-[200px] min-h-10 w-full resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-6 shadow-none dark:shadow-none field-sizing-content placeholder:truncate focus-visible:ring-0 dark:bg-transparent"
            rows={1}
            disabled={isStreaming}
          />
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <ComposerToolbar
                contextChars={contextChars + value.length}
                disabled={isStreaming}
                sessionProvider={sessionProvider}
              />
            </div>
            {isStreaming ? (
              <Button
                size="icon"
                variant="destructive"
                onClick={onInterrupt}
                className="size-8 shrink-0 cursor-pointer rounded-lg"
              >
                <Square className="size-3.5" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={onSend}
                disabled={!value.trim() || isThinking}
                title={t("ai.composer.sendHint")}
                className="size-8 shrink-0 cursor-pointer rounded-lg"
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  },
);
