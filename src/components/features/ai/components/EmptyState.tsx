"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  /** Translation function */
  t: (key: string) => string;
  /** Called when a quick prompt is selected */
  onSelectPrompt: (prompt: string) => void;
  /** Dynamic prompt suggestions based on current view */
  prompts: string[];
}

/**
 * Empty state shown when no messages exist in the conversation.
 * Displays quick prompt suggestions to help users get started.
 */
export function EmptyState({ t, onSelectPrompt, prompts }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-600/10 mb-4">
        <Sparkles className="size-7 text-violet-500/70" />
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t("ai.startConversation")}
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-sm">
        {prompts.map((prompt) => (
          <Button
            key={prompt}
            variant="outline"
            size="sm"
            className="text-xs h-8 cursor-pointer"
            onClick={() => onSelectPrompt(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
}
