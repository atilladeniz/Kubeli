"use client";

import { useState, useCallback, createContext, useContext, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PodTerminal } from "./PodTerminal";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TerminalTab {
  id: string;
  namespace: string;
  podName: string;
  container?: string;
  title?: string;
}

export function TerminalTabs({ className = "" }: { className?: string }) {
  const t = useTranslations("terminal");
  const { tabs, activeTabId, setActiveTab, removeTab } = useTerminalTabs();

  if (tabs.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full text-muted-foreground", className)}>
        <p>{t("noSessions")}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Tab bar */}
      <div className="flex items-center bg-muted/30 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "group flex items-center gap-2 px-3 py-2 border-r border-border cursor-pointer transition-colors",
              activeTabId === tab.id
                ? "bg-background text-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="text-sm truncate max-w-[150px]">
              {tab.title || tab.podName}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                removeTab(tab.id);
              }}
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Terminal content - render all tabs but only show active one */}
      <div className="flex-1 min-h-0 relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "absolute inset-0",
              tab.id === activeTabId ? "visible" : "invisible"
            )}
            style={{ display: tab.id === activeTabId ? "block" : "none" }}
          >
            <PodTerminal
              namespace={tab.namespace}
              podName={tab.podName}
              container={tab.container}
              sessionId={tab.id}
              onClose={() => removeTab(tab.id)}
              className="h-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Context for managing terminal tabs globally
interface TerminalTabsContextValue {
  tabs: TerminalTab[];
  activeTabId: string | null;
  addTab: (namespace: string, podName: string, container?: string) => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  closePanel: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const TerminalTabsContext = createContext<TerminalTabsContextValue | null>(null);

export function TerminalTabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const addTab = useCallback(
    (namespace: string, podName: string, container?: string) => {
      const id = `terminal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newTab: TerminalTab = {
        id,
        namespace,
        podName,
        container,
        title: `${podName}${container ? ` (${container})` : ""}`,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(id);
      setIsOpen(true);
      return id;
    },
    []
  );

  const removeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((tab) => tab.id !== id);
      if (newTabs.length === 0) {
        setIsOpen(false);
        setActiveTabId(null);
      } else {
        setActiveTabId((currentId) => {
          if (currentId === id) {
            const removedIndex = prev.findIndex((tab) => tab.id === id);
            return newTabs[removedIndex]?.id || newTabs[removedIndex - 1]?.id || newTabs[0]?.id || null;
          }
          return currentId;
        });
      }
      return newTabs;
    });
  }, []);

  const setActiveTab = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const closePanel = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
    setIsOpen(false);
  }, []);

  return (
    <TerminalTabsContext.Provider
      value={{
        tabs,
        activeTabId,
        addTab,
        removeTab,
        setActiveTab,
        closePanel,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </TerminalTabsContext.Provider>
  );
}

export function useTerminalTabs() {
  const context = useContext(TerminalTabsContext);
  if (!context) {
    throw new Error("useTerminalTabs must be used within a TerminalTabsProvider");
  }
  return context;
}
