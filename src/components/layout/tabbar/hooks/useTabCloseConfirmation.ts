"use client";

import { useCallback, useState } from "react";
import { useLogStore } from "@/lib/stores/log-store";
import { useUIStore } from "@/lib/stores/ui-store";
import type { Tab } from "@/lib/stores/tabs-store";
import type { PendingCloseState } from "../types";

interface UseTabCloseConfirmationArgs {
  tabs: Tab[];
  closeTab: (tabId: string) => void;
}

interface UseTabCloseConfirmationResult {
  pendingClose: PendingCloseState | null;
  dontAskAgain: boolean;
  setPendingClose: (value: PendingCloseState | null) => void;
  setDontAskAgain: (value: boolean) => void;
  requestCloseTab: (tab: Tab) => void;
  requestCloseOtherTabs: (keepTabId: string) => void;
  requestCloseTabsToRight: (tabId: string) => void;
  confirmClose: () => void;
}

export function useTabCloseConfirmation({
  tabs,
  closeTab,
}: UseTabCloseConfirmationArgs): UseTabCloseConfirmationResult {
  const [pendingClose, setPendingClose] = useState<PendingCloseState | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const isPodGoneWithLogs = useCallback((tabId: string) => {
    const tab = useLogStore.getState().logTabs[tabId];
    if (!tab || tab.logs.length === 0) return false;
    const error = tab.error;
    return !!error && (error.kind === "NotFound" || error.message.includes("not found"));
  }, []);

  const closeTabsWithConfirmation = useCallback(
    (tabIds: string[]) => {
      const confirmation = useUIStore.getState().settings.logCloseConfirmation;
      const needsConfirmation =
        confirmation !== "never" &&
        tabIds.some((id) => {
          const tab = tabs.find((currentTab) => currentTab.id === id);
          return tab?.type === "pod-logs" && isPodGoneWithLogs(id);
        });

      if (needsConfirmation) {
        setPendingClose({ tabIds });
        setDontAskAgain(false);
        return;
      }

      tabIds.forEach((id) => closeTab(id));
    },
    [closeTab, isPodGoneWithLogs, tabs]
  );

  const requestCloseTab = useCallback(
    (tab: Tab) => {
      closeTabsWithConfirmation([tab.id]);
    },
    [closeTabsWithConfirmation]
  );

  const requestCloseOtherTabs = useCallback(
    (keepTabId: string) => {
      const toClose = tabs.filter((tab) => tab.id !== keepTabId).map((tab) => tab.id);
      if (toClose.length === 0) return;
      closeTabsWithConfirmation(toClose);
    },
    [closeTabsWithConfirmation, tabs]
  );

  const requestCloseTabsToRight = useCallback(
    (tabId: string) => {
      const index = tabs.findIndex((tab) => tab.id === tabId);
      if (index === -1) return;
      const toClose = tabs.slice(index + 1).map((tab) => tab.id);
      if (toClose.length === 0) return;
      closeTabsWithConfirmation(toClose);
    },
    [closeTabsWithConfirmation, tabs]
  );

  const confirmClose = useCallback(() => {
    if (!pendingClose) return;

    if (dontAskAgain) {
      useUIStore.getState().updateSettings({ logCloseConfirmation: "never" });
    }
    pendingClose.tabIds.forEach((id) => closeTab(id));
    setPendingClose(null);
  }, [closeTab, dontAskAgain, pendingClose]);

  return {
    pendingClose,
    dontAskAgain,
    setPendingClose,
    setDontAskAgain,
    requestCloseTab,
    requestCloseOtherTabs,
    requestCloseTabsToRight,
    confirmClose,
  };
}
