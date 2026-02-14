"use client";

import { X } from "lucide-react";
import type { ResourceType } from "@/components/layout/sidebar/Sidebar";
import { TabBar } from "@/components/layout/tabbar/TabBar";
import { Titlebar } from "@/components/layout/titlebar/Titlebar";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { CreateResourceFAB } from "@/components/features/resources/CreateResourceFAB";
import { TerminalTabs } from "@/components/features/terminal";
import { NotConnectedState } from "../components";
import { ResourceView } from "../views";

interface DashboardMainWorkspaceProps {
  activeResource: ResourceType;
  isAIAssistantOpen: boolean;
  isAIProcessing: boolean;
  isAIDisabled: boolean;
  isConnected: boolean;
  isCreateResourceOpen: boolean;
  isTerminalOpen: boolean;
  terminalTabCount: number;
  terminalTitle: string;
  onCloseTerminal: () => void;
  onOpenCreateResource: () => void;
  onOpenSettings: () => void;
  onOpenShortcutsHelp: () => void;
  onToggleAI: () => void;
}

function MainResourceArea({
  activeResource,
  isConnected,
  isCreateResourceOpen,
  onOpenCreateResource,
  className = "h-full",
}: Pick<
  DashboardMainWorkspaceProps,
  "activeResource" | "isConnected" | "isCreateResourceOpen" | "onOpenCreateResource"
> & { className?: string }) {
  return (
    <main className={`${className} overflow-hidden relative group/main`}>
      {!isConnected ? (
        <NotConnectedState />
      ) : (
        <ResourceView activeResource={activeResource} />
      )}
      {isConnected && !isCreateResourceOpen && (
        <CreateResourceFAB
          activeResource={activeResource}
          onClick={onOpenCreateResource}
        />
      )}
    </main>
  );
}

export function DashboardMainWorkspace({
  activeResource,
  isAIAssistantOpen,
  isAIProcessing,
  isAIDisabled,
  isConnected,
  isCreateResourceOpen,
  isTerminalOpen,
  terminalTabCount,
  terminalTitle,
  onCloseTerminal,
  onOpenCreateResource,
  onOpenSettings,
  onOpenShortcutsHelp,
  onToggleAI,
}: DashboardMainWorkspaceProps) {
  return (
    <ResizablePanel id="main-content" minSize="400px">
      <div className="flex h-full flex-col overflow-hidden">
        <Titlebar
          isAIOpen={isAIAssistantOpen}
          isAIProcessing={isAIProcessing}
          isAIDisabled={isAIDisabled}
          onToggleAI={onToggleAI}
          onOpenShortcutsHelp={onOpenShortcutsHelp}
          onOpenSettings={onOpenSettings}
        />
        {isConnected && <TabBar />}
        {isTerminalOpen && terminalTabCount > 0 ? (
          <ResizablePanelGroup
            orientation="vertical"
            className="flex-1 overflow-hidden"
          >
            <ResizablePanel defaultSize="65%" minSize="20%">
              <MainResourceArea
                activeResource={activeResource}
                isConnected={isConnected}
                isCreateResourceOpen={isCreateResourceOpen}
                onOpenCreateResource={onOpenCreateResource}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="35%" minSize="15%" maxSize="70%">
              <div className="flex h-full flex-col border-t border-border">
                <div className="flex items-center justify-between bg-muted/50 px-3 py-1 border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {terminalTitle}
                  </span>
                  <Button variant="ghost" size="icon-sm" onClick={onCloseTerminal}>
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="flex-1 min-h-0">
                  <TerminalTabs />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <MainResourceArea
            activeResource={activeResource}
            isConnected={isConnected}
            isCreateResourceOpen={isCreateResourceOpen}
            onOpenCreateResource={onOpenCreateResource}
            className="flex-1"
          />
        )}
      </div>
    </ResizablePanel>
  );
}
