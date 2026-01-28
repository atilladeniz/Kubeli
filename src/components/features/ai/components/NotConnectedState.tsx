"use client";

import { Sparkles } from "lucide-react";

interface NotConnectedStateProps {
  title: string;
  description: string;
}

/**
 * State shown when no cluster is connected.
 */
export function NotConnectedState({ title, description }: NotConnectedStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 mb-4">
        <Sparkles className="size-8 text-violet-500" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
    </div>
  );
}
