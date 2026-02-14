"use client";

import { Settings, CircleHelp } from "lucide-react";
import { usePlatform } from "@/lib/hooks/usePlatform";
import { useContextMenuBlocker } from "./hooks/useContextMenuBlocker";
import { UpdateButton } from "./components/UpdateButton";
import { AIToggleButton } from "./components/AIToggleButton";
import { TitlebarIconButton } from "./components/TitlebarIconButton";
import type { TitlebarProps } from "./types";

export function Titlebar({ isAIOpen, isAIProcessing, isAIDisabled, onToggleAI, onOpenSettings, onOpenShortcutsHelp }: TitlebarProps) {
  const { modKeySymbol } = usePlatform();
  useContextMenuBlocker();

  return (
    <div data-tauri-drag-region className="h-7 shrink-0 flex items-center justify-end px-2 gap-1">
      <UpdateButton />

      {onToggleAI && (
        <AIToggleButton
          isOpen={isAIOpen}
          isProcessing={isAIProcessing}
          isDisabled={isAIDisabled}
          onToggle={onToggleAI}
        />
      )}

      {onOpenShortcutsHelp && (
        <TitlebarIconButton
          icon={CircleHelp}
          label="Keyboard Shortcuts"
          shortcut="?"
          onClick={onOpenShortcutsHelp}
        />
      )}

      {onOpenSettings && (
        <TitlebarIconButton
          icon={Settings}
          label="Settings"
          shortcut={`${modKeySymbol},`}
          onClick={onOpenSettings}
        />
      )}
    </div>
  );
}
