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
      <div className="border-t bg-background p-4">
        <div className="flex items-end gap-2">
          <Textarea
            ref={ref}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="max-h-[200px] resize-none text-sm field-sizing-content placeholder:truncate leading-6"
            rows={1}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button
              size="icon"
              variant="destructive"
              onClick={onInterrupt}
              className="shrink-0 size-10 cursor-pointer rounded-full"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={onSend}
              disabled={!value.trim() || isThinking}
              className="shrink-0 size-10 cursor-pointer rounded-full"
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Enter to send / Shift+Enter for new line
        </p>
      </div>
    );
  }
);
