"use client";

import { forwardRef, useCallback } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onInterrupt: () => void;
  placeholder: string;
  isStreaming: boolean;
  isThinking: boolean;
}

/**
 * Chat input area with auto-resizing textarea and send/stop buttons.
 */
export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  function ChatInput(
    { value, onChange, onSend, onInterrupt, placeholder, isStreaming, isThinking },
    ref
  ) {
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSend();
        }
      },
      [onSend]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
        const textarea = e.target;
        textarea.style.height = "auto";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
      },
      [onChange]
    );

    return (
      <div className="p-4">
        {/* Unified message field: textarea and action sit inside one raised
            surface, so the whole composer reads as a single control rather
            than a box plus a floating button. */}
        <div className="bg-surface-3 shadow-surface-3 border-surface-border focus-within:ring-ring/40 flex items-end gap-2 rounded-2xl border p-2 transition-shadow focus-within:ring-2">
          <Textarea
            ref={ref}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="max-h-[200px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-6 shadow-none field-sizing-content placeholder:truncate focus-visible:ring-0 dark:bg-transparent"
            rows={1}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button
              size="icon"
              variant="destructive"
              onClick={onInterrupt}
              className="size-9 shrink-0 cursor-pointer rounded-xl"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={onSend}
              disabled={!value.trim() || isThinking}
              className="size-9 shrink-0 cursor-pointer rounded-xl"
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
        <p className="text-muted-foreground mt-2 text-center text-[10px]">
          Enter to send / Shift+Enter for new line
        </p>
      </div>
    );
  }
);
